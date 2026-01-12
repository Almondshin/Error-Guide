package com.mobileok.identity.interfaces;

import com.mobileok.identity.domain.model.ResolutionCase;
import com.mobileok.identity.domain.repository.ResolutionCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/admin/cases")
@RequiredArgsConstructor
public class AdminCaseRestController {

    private final ResolutionCaseRepository repository;

    @GetMapping
    public Page<ResolutionCase> listAll(
            @PageableDefault(size = 15, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        log.info("REST: Fetching resolution cases with pagination: {}", pageable);
        return repository.findAll(pageable);
    }

    @PostMapping
    public ResponseEntity<ResolutionCase> createCase(@RequestBody ResolutionCase resolutionCase) {
        log.info("REST: Creating new resolution case for error: {}", resolutionCase.getErrorCode());
        return ResponseEntity.ok(repository.save(resolutionCase));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResolutionCase> updateCase(@PathVariable Long id, @RequestBody ResolutionCase resolutionCase) {
        log.info("REST: Updating resolution case ID: {}", id);
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        ResolutionCase updated = ResolutionCase.builder()
                .id(id)
                .errorCode(resolutionCase.getErrorCode())
                .requestDetail(resolutionCase.getRequestDetail())
                .logContext(resolutionCase.getLogContext())
                .resolution(resolutionCase.getResolution())
                .status(resolutionCase.getStatus())
                .build();
        return ResponseEntity.ok(repository.save(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCase(@PathVariable Long id) {
        log.info("REST: Deleting resolution case ID: {}", id);
        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
