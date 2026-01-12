package com.mobileok.identity.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "resolution_cases")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolutionCase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String errorCode;

    @Column(columnDefinition = "TEXT")
    private String logContext;

    @Column(columnDefinition = "TEXT")
    private String requestDetail;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @Builder.Default
    private String status = "완료";

    @Column(columnDefinition = "TEXT")
    private String solution;

    @Column(columnDefinition = "TEXT")
    private String vectorRepresentation;
}
