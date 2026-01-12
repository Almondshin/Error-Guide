package com.mobileok.identity.interfaces;

import com.mobileok.identity.application.VerificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/mok")
@RequiredArgsConstructor
public class IdentityVerificationController {

    private final VerificationService verificationService;

    @PostMapping("/client-info")
    public ResponseEntity<?> createClientInfo(@RequestBody Map<String, String> request) {
        // Step 1: JS -> CL : POST /mok/client-info
        String clientTxId = verificationService.requestVerification();
        String publicKey = request.get("publicKey");
        
        String encryptedInfo = verificationService.generateEncryptedClientInfo(clientTxId, publicKey);
        
        return ResponseEntity.ok(Map.of(
                "clientTxId", clientTxId,
                "encryptedInfo", encryptedInfo
        ));
    }

    @PostMapping("/token-receive")
    public ResponseEntity<?> receiveToken(@RequestBody Map<String, String> request) {
        // Step: MOK --> STD : (본인확인 임시 결과 토큰) 응답
        String clientTxId = request.get("clientTxId");
        verificationService.captureToken(clientTxId);
        return ResponseEntity.ok(Map.of("status", "Token received", "clientTxId", clientTxId));
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyResult(@RequestBody Map<String, String> request) {
        // Step: CL -> MOK : 본인확인 결과 요청
        String clientTxId = request.get("clientTxId");
        verificationService.verify(clientTxId);
        return ResponseEntity.ok(Map.of("status", "Verified", "clientTxId", clientTxId));
    }
}
