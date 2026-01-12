package com.mobileok.identity.interfaces;

import com.mobileok.identity.domain.model.MokErrorDictionary;
import com.mobileok.identity.domain.repository.MokErrorDictionaryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/errors")
@RequiredArgsConstructor
public class AdminErrorController {

    private final MokErrorDictionaryRepository repository;

    @GetMapping
    public Page<MokErrorDictionary> listErrors(
            @RequestParam(required = false) String query,
            @PageableDefault(size = 15) Pageable pageable) {
        if (query != null && !query.trim().isEmpty()) {
            return repository.search(query, pageable);
        }
        return repository.findAll(pageable);
    }

    @GetMapping("/all")
    public List<MokErrorDictionary> listAll() {
        return repository.findAll();
    }

    @PostMapping("/add")
    public ResponseEntity<MokErrorDictionary> addError(@RequestBody MokErrorDictionary error) {
        return ResponseEntity.ok(repository.save(error));
    }

    @PostMapping("/update")
    public ResponseEntity<MokErrorDictionary> updateError(@RequestBody MokErrorDictionary error) {
        if (error.getId() == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(repository.save(error));
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<Void> deleteError(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
