package com.mobileok.identity.infrastructure.logging.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;

@Slf4j
@Aspect
@Component
public class LoggingAspect {

    @Around("within(@org.springframework.web.bind.annotation.RestController *)")
    public Object logRestControllers(ProceedingJoinPoint joinPoint) throws Throwable {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
        
        String className = joinPoint.getSignature().getDeclaringTypeName();
        String methodName = joinPoint.getSignature().getName();
        long start = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            long duration = System.currentTimeMillis() - start;
            
            log.info("REST Request: {} {} | Controller: {}.{} | Duration: {}ms | Args: {}", 
                    request.getMethod(), request.getRequestURI(), className, methodName, duration, Arrays.toString(joinPoint.getArgs()));
            
            return result;
        } catch (Throwable e) {
            long duration = System.currentTimeMillis() - start;
            log.error("REST Error: {} {} | Controller: {}.{} | Duration: {}ms | Error: {}", 
                    request.getMethod(), request.getRequestURI(), className, methodName, duration, e.getMessage());
            throw e;
        }
    }
}
