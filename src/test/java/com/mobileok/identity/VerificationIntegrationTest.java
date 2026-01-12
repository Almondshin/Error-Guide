package com.mobileok.identity;

import com.mobileok.identity.domain.MokErrorDictionary;
import com.mobileok.identity.infrastructure.MokErrorDictionaryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.is;

@SpringBootTest(classes = ErrorApplication.class)
@ActiveProfiles("test")
@AutoConfigureMockMvc
public class VerificationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MokErrorDictionaryRepository errorDictionaryRepository;

    private String validPublicKeyBase64;

    @BeforeEach
    void setUp() throws Exception {
        // Generate a real RSA key pair for the test to ensure valid Base64 and format
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair pair = keyGen.generateKeyPair();
        validPublicKeyBase64 = Base64.getEncoder().encodeToString(pair.getPublic().getEncoded());

        // Seed the error dictionary for the test
        errorDictionaryRepository.save(new MokErrorDictionary(
                "5033",
                "Token Expired (5s)",
                "유효시간이 만료되었습니다. 처음부터 다시 시도해 주세요.",
                "DOMAIN",
                "CONFIRM_REQUEST",
                "Check if the client requested verification within 5 seconds.",
                "Customer will see an expiration message and needs to restart."
        ));
    }

    @Test
    public void testVerificationTimeoutScenario() throws Exception {
        // 1. Start verification (CREATED)
        MvcResult result = mockMvc.perform(post("/mok/client-info")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"publicKey\": \"" + validPublicKeyBase64 + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.clientTxId").exists())
                .andReturn();

        String content = result.getResponse().getContentAsString();
        String clientTxId = content.split("\"clientTxId\":\"")[1].split("\"")[0];

        // 2. Capture token (TOKEN_RECEIVED)
        mockMvc.perform(post("/mok/token-receive")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientTxId\": \"" + clientTxId + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("Token received")));

        // 3. Wait for 5 seconds to trigger the 4.8s pre-emptive timeout
        Thread.sleep(5000);

        // 4. Call /verify and assert 5033 error
        mockMvc.perform(post("/mok/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientTxId\": \"" + clientTxId + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code", is("5033")))
                .andExpect(jsonPath("$.message", is("유효시간이 만료되었습니다. 처음부터 다시 시도해 주세요.")))
                .andExpect(jsonPath("$.layer", is("DOMAIN")))
                .andExpect(jsonPath("$.step", is("CONFIRM_REQUEST")));
    }
}
