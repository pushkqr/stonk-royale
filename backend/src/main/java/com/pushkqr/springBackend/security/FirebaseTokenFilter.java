package com.pushkqr.springBackend.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.pushkqr.springBackend.entities.User;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.Optional;

public class FirebaseTokenFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if(header != null && header.startsWith("Bearer")){
            String idToken = header.replace("Bearer ", "");
            try{
                FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);

                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(decodedToken.getUid(), null, Collections.emptyList());

                SecurityContextHolder.getContext().setAuthentication(auth);
            }catch (Exception e){
                SecurityContextHolder.clearContext();
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.getWriter().write("Invalid Firebase Token");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
