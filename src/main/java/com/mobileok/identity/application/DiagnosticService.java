package com.mobileok.identity.application;

import com.mobileok.identity.domain.model.DiagnosticHistory;
import com.mobileok.identity.domain.model.MokErrorDictionary;
import com.mobileok.identity.domain.model.ResolutionCase;
import com.mobileok.identity.domain.repository.DiagnosticHistoryRepository;
import com.mobileok.identity.domain.repository.ResolutionCaseRepository;
import com.mobileok.identity.infrastructure.ErrorDictionaryService;
import com.mobileok.identity.infrastructure.GeminiApiClient;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiagnosticService {

    private final ErrorDictionaryService errorDictionaryService;
    private final ResolutionCaseRepository resolutionCaseRepository;
    private final DiagnosticHistoryRepository diagnosticHistoryRepository;
    private final GeminiApiClient geminiApiClient;

    @Getter
    @Builder
    public static class DiagnosticResult {
        private String errorCode;
        private String description;
        private String customerMessage;
        private String errorLayer;
        private String systemFlowStep;
        private String expertAnalysis;
        private String aiRecommendation;
        private Integer totalTokens;
        private boolean isWarning;
    }

    public DiagnosticResult diagnoseByIdOrCode(Long id, String errorCode, String rawLog) {
        MokErrorDictionary error = null;
        
        if (id != null) {
            error = errorDictionaryService.findById(id).orElse(null);
        }
        
        if (error == null && errorCode != null && !errorCode.trim().isEmpty()) {
            List<MokErrorDictionary> matches = errorDictionaryService.findByErrorCode(errorCode);
            if (!matches.isEmpty()) {
                error = matches.get(0);
            }
        }

        if (error == null && rawLog != null && !rawLog.trim().isEmpty()) {
            error = errorDictionaryService.findBestMatch(null, rawLog).orElse(null);
        }

        if (error == null) {
            String msg = (errorCode == null || errorCode.isEmpty()) 
                ? "분석할 에러 코드를 입력하거나 선택해 주십시오."
                : "입력하신 에러 코드는 현재 시스템에 등록되지 않은 코드입니다. [에러코드 관리] 메뉴에서 해당 코드를 먼저 등록해 주십시오.";
            return DiagnosticResult.builder()
                    .errorCode(errorCode != null ? errorCode : "N/A")
                    .expertAnalysis(msg)
                    .isWarning(true)
                    .build();
        }

        return performAnalysis(error, rawLog);
    }

    @Transactional
    public DiagnosticResult performAnalysis(MokErrorDictionary error, String rawLog) {
        // Fetch ONLY cases for the specific error code to avoid context pollution
        List<ResolutionCase> pastCases = resolutionCaseRepository.findByErrorCode(error.getErrorCode());
        String pastCasesContext = pastCases.isEmpty() ? "NO_PAST_CASES_FOUND_FOR_THIS_CODE" : 
                pastCases.stream()
                .map(c -> String.format("[과거 사례] 요청: %s -> 해결: %s", 
                        c.getRequestDetail(), c.getResolution()))
                .collect(Collectors.joining("\n"));

        String prompt = constructRefinedPrompt(error, pastCasesContext, rawLog);
        GeminiApiClient.GeminiResponse geminiResponse = geminiApiClient.generateContentExtended(prompt);

        String expertAnalysis;
        if ("AI_QUOTA_REACHED".equals(geminiResponse.text) || "ERROR_QUOTA_EXCEEDED".equals(geminiResponse.text)) {
            expertAnalysis = "현재 AI 분석 할당량이 소진되었습니다. 잠시 후 다시 시도해 주십시오.";
        } else {
            expertAnalysis = geminiResponse.text;
        }

        if (!"AI_QUOTA_REACHED".equals(geminiResponse.text) && !"ERROR_QUOTA_EXCEEDED".equals(geminiResponse.text)) {
            try {
                log.info("Saving diagnostic history for error: {}", error.getErrorCode());
                diagnosticHistoryRepository.saveAndFlush(DiagnosticHistory.builder()
                        .errorCode(error.getErrorCode())
                        .description(error.getDescription())
                        .aiReport(expertAnalysis)
                        .build());
            } catch (Exception e) {
                log.error("Failed to save history for error: {}", error.getErrorCode(), e);
            }
        }

        String aiRecommendation = (rawLog != null && !rawLog.trim().isEmpty())
                ? "로그 분석 결과에 따른 핵심 조치를 확인하십시오."
                : "정확한 분석을 위해 로그 입력을 권장합니다.";

        return DiagnosticResult.builder()
                .errorCode(error.getErrorCode())
                .description(error.getDescription())
                .customerMessage(error.getCustomerMessage())
                .errorLayer(error.getErrorLayer())
                .systemFlowStep(error.getSystemFlowStep())
                .expertAnalysis(expertAnalysis)
                .aiRecommendation(aiRecommendation)
                .totalTokens(geminiResponse.totalTokens)
                .isWarning(false)
                .build();
    }

    @Transactional
    public void registerCaseFromHistory(Long historyId) {
        DiagnosticHistory history = diagnosticHistoryRepository.findById(historyId)
                .orElseThrow(() -> new IllegalArgumentException("History not found: " + historyId));

        ResolutionCase resolutionCase = ResolutionCase.builder()
                .errorCode(history.getErrorCode())
                .logContext(history.getDescription()) // Mapping history description to logContext
                .requestDetail("진단 히스토리에서 복제됨")
                .resolution(history.getAiReport())
                .status("COMPLETED")
                .build();

        resolutionCaseRepository.save(resolutionCase);
        diagnosticHistoryRepository.deleteById(historyId);
        log.info("Successfully registered case and deleted history for ID: {}", historyId);
    }

    private String constructRefinedPrompt(MokErrorDictionary error, String pastCases, String rawLog) {
        String baseDescription = error.getDescription();
        StringBuilder specialDirective = new StringBuilder();
        
        if ("5033".equals(error.getErrorCode())) {
            specialDirective.append("### [5033 에러 특별 지침]\n")
                    .append("[핵심 조치 사항] 섹션에 다음 두 질문을 반드시 포함하십시오:\n")
                    .append("1. \"토큰 발급 후 10분이 경과했는지 확인하셨나요?\" (본인확인 절차는 10분 이내 완료 필수입니다.)\n")
                    .append("2. \"혹시 만료된 토큰을 재사용하고 계신 건 아닌가요?\" (신규 인증 시 신규 토큰 발급이 필수입니다.)\n");
        }

        if ("5038".equals(error.getErrorCode())) {
            specialDirective.append("### [5038 에러 전용 비즈니스 힌트]\n")
                    .append("- 이 에러는 결과 토큰 발급 이후 **유효시간(TTL)이 5초**로 설정되어 발생합니다.\n")
                    .append("- [핵심 조치 사항]에 반드시 다음 내용을 포함하십시오: \"결과 토큰 발급 후 **반드시 5초 이내에 결과 요청**을 보내야 합니다. 이용기관의 검증 요청과 결과 요청 사이의 지연 시간이 5초를 초과하는지 확인하십시오.\"\n");
        }

        if ("2910".equals(error.getErrorCode()) || "62910".equals(error.getErrorCode())) {
            specialDirective.append("### [2910/62910 에러 특별 지침]\n")
                    .append("[핵심 조치 사항] 섹션에 다음 내용을 반드시 포함하십시오:\n")
                    .append("\"가입자 정보 및 인증번호 입력 정확성 확인을 우선적으로 요청하십시오. 특히, 통신사, 이름, 생년월일, 전화번호 등 필수 정보가 정확히 입력되었는지, 또는 입력된 인증번호가 유효한지 확인해야 합니다.\"\n");
        }

        if ("4101".equals(error.getErrorCode())) {
            specialDirective.append("### [4101 에러 절대 금지 지침]\n")
                    .append("- '키 파일', '라이브러리', 'Referer', '암호화 라이브러리' 등은 4101 에러와 무관하므로 절대 언급하지 마십시오.\n")
                    .append("- 만약 과거 사례에 해당 단어들이 없다면, 네가 지어내서 쓰는 순간 오답 처리됩니다.\n");
        }

        if ("5024".equals(error.getErrorCode())) {
            specialDirective.append("### [5024 에러 특별 지침]\n")
                    .append("[핵심 조치 사항] 또는 [에러 개요] 섹션에 다음 문장을 반드시 포함하십시오:\n")
                    .append("\"해당 에러는 검증번호를 입력하지 않은 경우 발생하나, 일반적인 경우가 아니므로 응대 후 체크가 필요합니다.\"\n");
        }

        String today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));

        boolean noPastCases = "NO_PAST_CASES_FOUND_FOR_THIS_CODE".equals(pastCases);

        return String.format(
                "보고서 제목: MOK Error Agent report\n" +
                "보고서 작성일: %s\n" +
                "너는 제공된 텍스트 데이터만 대조하는 '데이터 대조기'로 동작한다. 너의 상식이나 외부 지식을 1%%라도 섞는다면 이는 심각한 분석 오류다.\n" +
                "전문적이고 정중하며 격식 있는 한국어 톤을 사용하라. 모든 문장은 반드시 \"~입니다\" 또는 \"~하십시오\"로 끝나야 한다.\n" +
                "불필요한 인사말, '기술적 대응 방안', '비즈니스 대응 방안', '결론' 섹션은 절대 포함하지 마라.\n\n" +
                "### [CRITICAL CONSTRAINTS - ZERO KNOWLEDGE BASE]\n" +
                "1. 너는 오직 제공된 컨텍스트만을 분석하는 포렌식 분석가다.\n" +
                "2. 'Key files', 'BouncyCastle', 'Library paths', 'Referer' 등 제공된 '과거 사례' 섹션에 명시되지 않은 내용은 절대 언급하는 것을 금지한다.\n" +
                "3. %s\n" +
                "4. 고객이 소스 코드를 올바르게 작성했다고 주장하더라도, 실제 전송되는 데이터 흐름(ELK 로그 등)에서 필드가 누락되었을 가능성을 우선적으로 제시하라.\n" +
                "5. 제공된 사례 컨텍스트가 불충분하다면 보고서를 더 짧게 작성하라. 정확성이 길이보다 중요하다. 보고서를 채우기 위해 또한 원인을 지어내지 마라.\n" +
                "6. 만약 동일한 에러코드의 과거 사례에 해당 단어들이 없다면, 네가 지어내서 쓰는 순간 오답 처리됩니다.\n" +
                "7. CRITICAL: NEVER invent or hallucinate specific IDs, Service IDs, IP addresses, or payloads that are not explicitly present in the '현재 로그' section.\n" +
                "8. If the '현재 로그' is vague or lacks technical data (e.g., '이거뭐야'), simply state: '제공된 로그에 분석 가능한 기술적 파라미터가 부재합니다.' Do not make up a Service ID.\n\n" +
                "### [기술적 맥락 참고 지침]\n" +
                "DB의 description 필드에 있는 [Enum변수명]을 참고하여, 해당 기술적 맥락을 바탕으로 리포트를 작성하십시오.\n\n" +
                "### [시스템 단계 정보]\n" +
                "현재 에러가 발생한 단계는 [%s] 단계입니다. 이 단계의 특성을 고려하여 분석하십시오.\n\n" +
                "%s\n" +
                "### [입력 정보]\n" +
                "- 에러코드: %s\n" +
                "- DB 설명: %s\n" +
                "- 과거사례 (오직 에러코드 %s에 해당하는 사례만 제공됨):\n%s\n" +
                "- 현재로그: %s\n\n" +
                "### [보고서 필수 구조 및 템플릿]\n" +
                "1. [에러 개요]: \"에러 코드 [%s]는 [%s]와 관련된 문제입니다.\"\n" +
                "2. [문의-사례 연결 분석]: %s\n" +
                "3. [핵심 조치 사항]: %s\n\n" +
                "반드시 위 구조를 지키고 한국어로 작성하라. 섹션 제목은 ### [제목] 형식을 사용하라.",
                today,
                noPastCases ? "If no past cases are available, do not give up. Instead, analyze the 'DB 설명' (the technical definition of the error) and the '현재 로그' to provide a logical expert hypothesis. In this case, you are allowed to use your domain knowledge of identity authentication systems to suggest the most likely cause for this specific technical error name." 
                            : "만약 '과거사례' 섹션이 'NO_PAST_CASES_FOUND_FOR_THIS_CODE'라고 되어 있다면, 반드시 해당 에러 코드에 대한 과거 데이터가 존재하지 않음을 명시하라.",
                error.getSystemFlowStep(),
                specialDirective.toString(),
                error.getErrorCode(), baseDescription,
                error.getErrorCode(),
                pastCases,
                rawLog == null || rawLog.isEmpty() ? "없음" : rawLog,
                error.getErrorCode(), baseDescription,
                noPastCases ? "Describe the technical meaning of the error code based on the DB Description and explain how it relates to the provided raw log." 
                            : "현재 에러코드와 제공된 과거 사례 사이의 유사점을 찾아 연결 분석을 수행하십시오. 일치하는 사례가 없다면 \"현재 에러코드와 일치하는 과거 해결 사례가 부재하여 패턴 분석이 제한적입니다.\"라고 명시하십시오.",
                noPastCases ? "Provide a logical first step for the engineer based on the technical context (e.g., 'If the error means X, you should check Y')."
                            : "과거 사례의 해결책을 최우선으로 제시하고, 없다면 로그에서 의심되는 지점 딱 한 가지만 제시하십시오."
        );
    }
}
