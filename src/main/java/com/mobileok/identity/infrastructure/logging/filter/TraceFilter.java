package com.mobileok.identity.infrastructure.logging.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

@Component
public class TraceFilter implements Filter {

    private static final String TRACE_ID = "traceId";
    private static final String TRACE_HEADER = "X-Trace-Id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        try {
            String traceId = UUID.randomUUID().toString();
            MDC.put(TRACE_ID, traceId);
            
            if (response instanceof HttpServletResponse) {
                ((HttpServletResponse) response).setHeader(TRACE_HEADER, traceId);
            }
            
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
