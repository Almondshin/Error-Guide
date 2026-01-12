package com.mobileok.identity.infrastructure;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class GeminiApiClient {

    private final RestTemplate restTemplate;

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.url}")
    private String apiUrl;

    public static class GeminiResponse {
        public String text;
        public Integer totalTokens;
    }

    public GeminiResponse generateContentExtended(String prompt) {
        // Log URL without key for security
        String safeUrl = apiUrl.replaceAll("key=[^&]*", "key=***");
        log.info("Calling Gemini 2.0 Flash API: {}", safeUrl);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // The key is now passed via URL query param in application.yml, but can also be a header if needed.
        // Google AI Studio API usually takes key in query param.
        // If using Vertex AI, it might be different. Assuming AI Studio here.

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("text", prompt)
                        ))
                )
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        GeminiResponse result = new GeminiResponse();

        try {
            Map<String, Object> response = restTemplate.postForObject(apiUrl, entity, Map.class);
            if (response != null) {
                // Extract Content with robustness
                if (response.containsKey("candidates")) {
                    List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
                    if (candidates != null && !candidates.isEmpty()) {
                        Map<String, Object> candidate = candidates.get(0);
                        if (candidate != null && candidate.containsKey("content")) {
                            Map<String, Object> content = (Map<String, Object>) candidate.get("content");
                            if (content != null && content.containsKey("parts")) {
                                List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                                if (parts != null && !parts.isEmpty()) {
                                    result.text = (String) parts.get(0).get("text");
                                }
                            }
                        }
                    }
                }

                // Extract and Log Token Usage with robustness
                if (response.containsKey("usageMetadata")) {
                    Map<String, Object> usage = (Map<String, Object>) response.get("usageMetadata");
                    int promptTokens = getInt(usage, "promptTokenCount");
                    int candidatesTokens = getInt(usage, "candidatesTokenCount");
                    int totalTokens = getInt(usage, "totalTokenCount");
                    
                    result.totalTokens = totalTokens;
                    
                    log.info("[Gemini Usage] Prompt: {}, Candidates: {}, Total: {} tokens.", 
                            promptTokens, candidatesTokens, totalTokens);
                }
            }
        } catch (HttpClientErrorException.TooManyRequests e) {
            log.warn("Gemini API Quota Reached (429)");
            result.text = "AI_QUOTA_REACHED";
        } catch (HttpClientErrorException e) {
            log.error("Gemini API HTTP Error: {} - {}", e.getStatusCode(), e.getResponseBodyAsString());
            result.text = "ERROR: " + e.getStatusCode();
        } catch (Exception e) {
            log.error("Gemini API call failed: {}", e.getMessage());
            result.text = "ERROR: " + e.getMessage();
        }

        if (result.text == null) {
            result.text = "AI 응답을 생성할 수 없습니다.";
        }
        
        return result;
    }

    private int getInt(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) {
            return ((Number) val).intValue();
        }
        return 0;
    }

    public String generateContent(String prompt) {
        return generateContentExtended(prompt).text;
    }
}
