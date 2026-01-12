package com.mobileok.identity.interfaces;

import com.mobileok.identity.application.DiagnosticService;
import com.mobileok.identity.domain.model.MokErrorDictionary;
import com.mobileok.identity.domain.repository.MokErrorDictionaryRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/diagnose")
@RequiredArgsConstructor
public class DiagnosticController {

    private final DiagnosticService diagnosticService;
    private final MokErrorDictionaryRepository errorRepository;

    @Getter
    @Builder
    public static class DiagnosticRequest {
        private Long id;
        private String code;
        private String rawLog;
    }

    @Getter
    @Builder
    public static class ErrorCodeSummary {
        private Long id;
        private String code;
        private String description;
    }

    @PostMapping("/analyze")
    public ResponseEntity<DiagnosticService.DiagnosticResult> analyze(@RequestBody DiagnosticRequest request) {
        return ResponseEntity.ok(diagnosticService.diagnoseByIdOrCode(request.getId(), request.getCode(), request.getRawLog()));
    }

    @GetMapping("/errors/all")
    public ResponseEntity<List<ErrorCodeSummary>> getAllErrors() {
        List<MokErrorDictionary> errors = errorRepository.findAll();
        List<ErrorCodeSummary> summaries = errors.stream()
                .map(e -> ErrorCodeSummary.builder()
                        .id(e.getId())
                        .code(e.getErrorCode())
                        .description(e.getDescription())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(summaries);
    }
}
