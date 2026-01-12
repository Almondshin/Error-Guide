package com.mobileok.identity.domain.repository;

import com.mobileok.identity.domain.model.VerificationTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VerificationTransactionRepository extends JpaRepository<VerificationTransaction, Long> {
    Optional<VerificationTransaction> findByClientTxId(String clientTxId);
}
