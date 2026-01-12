package com.mobileok.identity.domain.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "verification_transactions")
@Getter
@NoArgsConstructor
public class VerificationTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String clientTxId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private VerificationState state;

    private LocalDateTime tokenReceivedAt;

    @Version
    private Long version;

    public VerificationTransaction(String clientTxId) {
        this.clientTxId = clientTxId;
        this.state = VerificationState.CREATED;
    }

    public void requestAuth() {
        if (this.state != VerificationState.CREATED) {
            throw new IllegalStateException("Invalid transition: " + this.state + " -> AUTH_REQUESTED");
        }
        this.state = VerificationState.AUTH_REQUESTED;
    }

    public void receiveToken() {
        if (this.state != VerificationState.AUTH_REQUESTED) {
            throw new IllegalStateException("Invalid transition: " + this.state + " -> TOKEN_RECEIVED");
        }
        this.state = VerificationState.TOKEN_RECEIVED;
        this.tokenReceivedAt = LocalDateTime.now();
    }

    public void verify() {
        if (this.state != VerificationState.TOKEN_RECEIVED) {
             throw new IllegalStateException("Invalid transition: " + this.state + " -> VERIFIED");
        }

        // Pre-emptive Expiration Logic (5.0s)
        if (this.tokenReceivedAt != null) {
            long elapsedMillis = ChronoUnit.MILLIS.between(this.tokenReceivedAt, LocalDateTime.now());
            if (elapsedMillis > 5000) {
                this.state = VerificationState.EXPIRED;
                throw new IllegalStateException("Transaction expired (Pre-emptive 5.0s rule)");
            }
        }

        this.state = VerificationState.VERIFIED;
    }
}
