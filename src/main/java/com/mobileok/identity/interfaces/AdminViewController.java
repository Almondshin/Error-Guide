package com.mobileok.identity.interfaces;

import com.mobileok.identity.domain.repository.DiagnosticHistoryRepository;
import com.mobileok.identity.domain.repository.ResolutionCaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminViewController {

    private final DiagnosticHistoryRepository diagnosticHistoryRepository;
    private final ResolutionCaseRepository resolutionCaseRepository;

    @GetMapping("/management")
    public String adminErrorsPage() {
        return "admin-errors";
    }

    @GetMapping("/cases")
    public String adminCasesPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size,
            Model model) {
        model.addAttribute("cases", resolutionCaseRepository.findAll(
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"))));
        return "admin-cases";
    }

    @GetMapping("/history")
    public String adminHistoryPage(Model model) {
        model.addAttribute("histories", diagnosticHistoryRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")));
        return "admin-history";
    }

    @GetMapping("/cases-page")
    public String legacyAdminCasesPage() {
        return "redirect:/admin/cases";
    }

    @GetMapping("/errors-page")
    public String legacyAdminErrorsPage() {
        return "redirect:/admin/management";
    }
}
