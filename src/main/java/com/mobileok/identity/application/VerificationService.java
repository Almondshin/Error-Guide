package com.mobileok.identity.application;

import com.mobileok.identity.domain.model.VerificationTransaction;
import com.mobileok.identity.domain.repository.VerificationTransactionRepository;
import com.mobileok.identity.exception.MobileOkException;
import com.mobileok.identity.infrastructure.MokCryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationService {

    private final VerificationTransactionRepository repository;
    private final MokCryptoService cryptoService;

    @Transactional
    public String requestVerification() {
        String clientTxId = UUID.randomUUID().toString();
        VerificationTransaction transaction = new VerificationTransaction(clientTxId);
        repository.save(transaction);
        log.info("Created verification transaction: {}", clientTxId);
        return clientTxId;
    }

    @Transactional
    public void captureToken(String clientTxId) {
        VerificationTransaction transaction = repository.findByClientTxId(clientTxId)
                .orElseThrow(() -> new MobileOkException("4004")); // Transaction Not Found

        transaction.requestAuth(); // Transition to AUTH_REQUESTED
        transaction.receiveToken(); // Transition to TOKEN_RECEIVED
        repository.save(transaction);
        log.info("Token received for transaction: {}", clientTxId);
    }

    @Transactional
    public void verify(String clientTxId) {
        VerificationTransaction transaction = repository.findByClientTxId(clientTxId)
                .orElseThrow(() -> new MobileOkException("4004"));

        try {
            transaction.verify();
            repository.save(transaction);
            log.info("Transaction verified successfully: {}", clientTxId);
        } catch (IllegalStateException e) {
            if (e.getMessage().contains("expired")) {
                log.warn("Transaction expired: {}", clientTxId);
                throw new MobileOkException("5033"); // Token Expired (5s)
            }
            throw new MobileOkException("4000", e.getMessage()); // Generic Domain Error
        }
    }

    public String generateEncryptedClientInfo(String clientTxId, String publicKey) {
        try {
            // Mock payload for MOKReqClientInfo
            String payload = "{\"clientTxId\":\"" + clientTxId + "\", \"serviceId\":\"MOK_SERVICE\"}";
            return cryptoService.encryptRsa(payload, publicKey);
        } catch (Exception e) {
            log.error("Encryption failed for clientTxId: {}", clientTxId, e);
            throw new MobileOkException("8102"); // Encryption Failure
        }
    }
}
