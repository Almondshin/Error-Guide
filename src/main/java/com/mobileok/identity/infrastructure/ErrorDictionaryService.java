package com.mobileok.identity.infrastructure;

import com.mobileok.identity.domain.model.MokErrorDictionary;
import com.mobileok.identity.domain.repository.MokErrorDictionaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ErrorDictionaryService {

    private final MokErrorDictionaryRepository repository;

    public List<MokErrorDictionary> findByErrorCode(String errorCode) {
        return repository.findByErrorCode(errorCode);
    }

    public Optional<MokErrorDictionary> findById(Long id) {
        return repository.findById(id);
    }

    public Optional<MokErrorDictionary> findBestMatch(String errorCode, String rawLog) {
        if (errorCode != null && !errorCode.trim().isEmpty()) {
            List<MokErrorDictionary> matches = repository.findByErrorCode(errorCode);
            if (!matches.isEmpty()) return Optional.of(matches.get(0));
        }

        if (rawLog != null && !rawLog.trim().isEmpty()) {
            List<MokErrorDictionary> all = repository.findAll();
            return all.stream()
                    .filter(e -> rawLog.contains(e.getErrorCode()) || 
                                (e.getDescription() != null && rawLog.contains(e.getDescription())))
                    .findFirst();
        }

        return Optional.empty();
    }
}
