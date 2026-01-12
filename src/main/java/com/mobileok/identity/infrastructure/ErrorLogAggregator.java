package com.mobileok.identity.infrastructure;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ErrorLogAggregator {

    // Mock storage for error counts. In a real app, this would query DB or use Redis.
    private final Map<String, Integer> errorCounts = new ConcurrentHashMap<>();

    public void recordError(String errorCode) {
        errorCounts.merge(errorCode, 1, Integer::sum);
    }

    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void aggregateAndLog() {
        if (errorCounts.isEmpty()) {
            return;
        }

        // Structured JSON Summary for ELK
        log.info("{\"type\": \"ERROR_AGGREGATION\", \"period\": \"LAST_HOUR\", \"counts\": {}}", errorCounts);
        
        errorCounts.clear();
    }
}
