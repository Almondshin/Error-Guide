package com.mobileok.identity.infrastructure;

import org.springframework.stereotype.Service;
import java.util.Base64;

/**
 * Simulator for MokCryptoService to focus on Diagnostic Guide mission.
 */
@Service
public class MokCryptoService {

    public String encryptRsa(String plainText, String publicKeyBase64) {
        // Simulator: Return a mock encrypted string
        return "MOCK_RSA_ENCRYPTED_" + Base64.getEncoder().encodeToString(plainText.getBytes());
    }

    public String decryptRsa(String encryptedText, String privateKeyBase64) {
        // Simulator: Return a mock decrypted string
        return "MOCK_RSA_DECRYPTED_DATA";
    }

    public String encryptAes(String plainText, String secretKeyBase64, String ivBase64) {
        return "MOCK_AES_ENCRYPTED_" + plainText;
    }

    public String decryptAes(String encryptedText, String secretKeyBase64, String ivBase64) {
        return "MOCK_AES_DECRYPTED_DATA";
    }
}
