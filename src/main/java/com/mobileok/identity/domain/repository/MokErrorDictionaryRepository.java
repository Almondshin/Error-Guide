package com.mobileok.identity.domain.repository;

import com.mobileok.identity.domain.model.MokErrorDictionary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MokErrorDictionaryRepository extends JpaRepository<MokErrorDictionary, Long> {
    List<MokErrorDictionary> findByErrorCode(String errorCode);

    @Query("SELECT e FROM MokErrorDictionary e WHERE e.errorCode LIKE %:query% OR e.description LIKE %:query%")
    Page<MokErrorDictionary> search(@Param("query") String query, Pageable pageable);
}
