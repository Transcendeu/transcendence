FROM owasp/modsecurity:3

# Copy ModSecurity and Nginx configuration
COPY modsecurity.conf /etc/modsecurity/modsecurity.conf
COPY main.conf /etc/nginx/conf.d/default.conf

# Create log directory and set permissions
RUN mkdir -p /var/log/modsecurity && \
    chown -R nginx:nginx /var/log/modsecurity

# Expose port 8080 for the web application
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"] 