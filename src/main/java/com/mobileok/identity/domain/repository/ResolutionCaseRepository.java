package com.mobileok.identity.domain.repository;

import com.mobileok.identity.domain.model.ResolutionCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResolutionCaseRepository extends JpaRepository<ResolutionCase, Long> {
    List<ResolutionCase> findByErrorCode(String errorCode);
}
