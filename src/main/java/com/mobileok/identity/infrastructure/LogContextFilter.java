package com.mobileok.identity.infrastructure;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

@Component
public class LogContextFilter implements Filter {

    private static final String TRACE_ID = "traceId";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        try {
            String traceId = UUID.randomUUID().toString();
            MDC.put(TRACE_ID, traceId);
            
            // If we had access to the transaction state here (e.g. from a header or token), we could add it.
            // For now, we just initialize the traceId.
            
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
