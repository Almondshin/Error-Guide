package com.mobileok.identity.domain.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "mok_error_dictionary")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MokErrorDictionary {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String errorCode;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(columnDefinition = "TEXT")
    private String customerMessage;
    
    private String errorLayer;
    private String systemFlowStep;
    
    @Column(columnDefinition = "TEXT")
    private String architectFix;
    
    @Column(columnDefinition = "TEXT")
    private String pmImpact;

    public MokErrorDictionary(String errorCode, String description, String customerMessage, String errorLayer, String systemFlowStep, String architectFix, String pmImpact) {
        this.errorCode = errorCode;
        this.description = description;
        this.customerMessage = customerMessage;
        this.errorLayer = errorLayer;
        this.systemFlowStep = systemFlowStep;
        this.architectFix = architectFix;
        this.pmImpact = pmImpact;
    }
}
