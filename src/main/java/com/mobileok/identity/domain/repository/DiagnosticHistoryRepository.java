package com.mobileok.identity.domain.repository;

import com.mobileok.identity.domain.model.DiagnosticHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DiagnosticHistoryRepository extends JpaRepository<DiagnosticHistory, Long> {
}
