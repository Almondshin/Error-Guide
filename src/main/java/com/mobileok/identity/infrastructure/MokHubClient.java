package com.mobileok.identity.infrastructure;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Simulator for MokHubClient to focus on Diagnostic Guide mission.
 */
@Component
@RequiredArgsConstructor
public class MokHubClient {

    @CircuitBreaker(name = "mokHubService", fallbackMethod = "fallbackConfirm")
    public Map<String, Object> confirmRequest(String token) {
        // Simulator: Return a mock success response
        return Map.of(
                "status", "SUCCESS",
                "userName", "홍길동",
                "userPhone", "010-1234-5678",
                "ci", "MOCK_CI_DATA"
        );
    }

    public Map<String, Object> fallbackConfirm(String token, Throwable t) {
        return Map.of("error", "CIRCUIT_OPEN", "message", "MOK Hub Simulator: Circuit Breaker Active");
    }
}
