package com.mobileok.identity.interfaces;

import com.mobileok.identity.domain.model.MokErrorDictionary;
import com.mobileok.identity.exception.MobileOkException;
import com.mobileok.identity.infrastructure.ErrorDictionaryService;
import com.mobileok.identity.infrastructure.LogMasking;
import com.mobileok.identity.interfaces.dto.StandardErrorResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final ErrorDictionaryService errorDictionaryService;
    private final LogMasking logMasking;

    @ExceptionHandler(MobileOkException.class)
    public ResponseEntity<StandardErrorResponse> handleMobileOkException(MobileOkException ex) {
        String errorCode = ex.getErrorCode();
        Optional<MokErrorDictionary> errorOpt = errorDictionaryService.findByErrorCode(errorCode).stream().findFirst();

        MokErrorDictionary error = errorOpt.orElseGet(() -> new MokErrorDictionary(
                "9999", "System Error", "일시적인 시스템 오류입니다.", "SYSTEM", "UNKNOWN",
                "Check system logs.", "Service disruption."
        ));

        String logMessage = String.format("Error: [%s] %s - %s", error.getErrorCode(), error.getDescription(), error.getCustomerMessage());
        
        if (ex.getArgs() != null && ex.getArgs().length > 0) {
             StringBuilder maskedArgs = new StringBuilder(" Args: ");
             for(String arg : ex.getArgs()) {
                 maskedArgs.append(logMasking.maskName(arg)).append(" ");
             }
             logMessage += maskedArgs.toString();
        }

        if ("INFRASTRUCTURE".equalsIgnoreCase(error.getErrorLayer()) || "CRYPTO".equalsIgnoreCase(error.getErrorLayer())) {
            log.error(logMessage, ex);
        } else {
            log.warn(logMessage);
        }

        StandardErrorResponse response = StandardErrorResponse.builder()
                .code(error.getErrorCode())
                .message(error.getCustomerMessage())
                .layer(error.getErrorLayer())
                .step(error.getSystemFlowStep())
                .timestamp(LocalDateTime.now())
                .build();

        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Void> handleNoResourceFoundException(NoResourceFoundException ex) {
        if (ex.getResourcePath().contains("favicon.ico")) {
            log.debug("Favicon not found: {}", ex.getResourcePath());
        } else {
            log.warn("Resource not found: {}", ex.getResourcePath());
        }
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<StandardErrorResponse> handleException(Exception ex) {
        log.error("Unhandled Exception", ex);
        StandardErrorResponse response = StandardErrorResponse.builder()
                .code("9999")
                .message("일시적인 시스템 오류입니다.")
                .layer("SYSTEM")
                .step("UNKNOWN")
                .timestamp(LocalDateTime.now())
                .build();
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
