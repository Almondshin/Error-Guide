package com.mobileok.identity.interfaces;

import com.mobileok.identity.application.DiagnosticService;
import com.mobileok.identity.domain.model.VerificationTransaction;
import com.mobileok.identity.domain.repository.VerificationTransactionRepository;
import com.mobileok.identity.infrastructure.LogMasking;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final VerificationTransactionRepository transactionRepository;
    private final DiagnosticService diagnosticService;
    private final LogMasking logMasking;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Getter
    @Builder
    public static class AdminDiagnosticResponse {
        private String clientTxId;
        private String state;
        private DiagnosticService.DiagnosticResult diagnosis;
        private Map<String, String> maskedMetadata;
    }

    @GetMapping("/diagnose/{clientTxId}")
    public ResponseEntity<AdminDiagnosticResponse> getDiagnosis(@PathVariable String clientTxId) {
        VerificationTransaction transaction = transactionRepository.findByClientTxId(clientTxId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        String errorCode = transaction.getState().name().equals("EXPIRED") ? "5033" : "0000";
        
        DiagnosticService.DiagnosticResult diagnosis = diagnosticService.diagnoseByIdOrCode(null, errorCode, "Manual Admin Diagnosis");

        AdminDiagnosticResponse response = AdminDiagnosticResponse.builder()
                .clientTxId(transaction.getClientTxId())
                .state(transaction.getState().name())
                .diagnosis(diagnosis)
                .maskedMetadata(Map.of(
                        "sampleUser", logMasking.maskName("홍길동")
                ))
                .build();

        return ResponseEntity.ok(response);
    }

    @GetMapping("/monitoring/circuit-breakers")
    public ResponseEntity<?> getCircuitBreakerStatus() {
        return ResponseEntity.ok(circuitBreakerRegistry.getAllCircuitBreakers().stream()
                .collect(Collectors.toMap(
                        CircuitBreaker::getName,
                        cb -> Map.of(
                                "state", cb.getState().name(),
                                "failureRate", cb.getMetrics().getFailureRate() + "%",
                                "slowCallRate", cb.getMetrics().getSlowCallRate() + "%"
                        )
                )));
    }
}
