package com.mobileok.identity.interfaces;

import com.mobileok.identity.domain.model.DiagnosticHistory;
import com.mobileok.identity.domain.model.ResolutionCase;
import com.mobileok.identity.domain.repository.DiagnosticHistoryRepository;
import com.mobileok.identity.domain.repository.ResolutionCaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/history")
@RequiredArgsConstructor
public class HistoryController {

    private final DiagnosticHistoryRepository historyRepository;
    private final ResolutionCaseRepository resolutionCaseRepository;

    @GetMapping
    public Page<DiagnosticHistory> listHistory(
            @PageableDefault(size = 15, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return historyRepository.findAll(pageable);
    }

    @GetMapping("/detail/{id}")
    public ResponseEntity<DiagnosticHistory> getHistoryDetail(@PathVariable Long id) {
        return historyRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteHistory(@PathVariable Long id) {
        historyRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/clone-to-resolution/{id}")
    public ResponseEntity<ResolutionCase> cloneToResolution(@PathVariable Long id) {
        DiagnosticHistory history = historyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("History not found"));

        ResolutionCase resolutionCase = ResolutionCase.builder()
                .errorCode(history.getErrorCode())
                .requestDetail(history.getDescription())
                .resolution(history.getAiReport())
                .status("완료")
                .build();

        return ResponseEntity.ok(resolutionCaseRepository.save(resolutionCase));
    }
}
