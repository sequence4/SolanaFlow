FROM ghcr.io/hhdgknsn/workspace:anchor
COPY ws-heartbeat.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/ws-heartbeat.sh
EXPOSE 3000
ENV WORKSPACE_ID=${HOSTNAME}
ENTRYPOINT ["ws-heartbeat.sh"]
CMD ["code-server","--bind-addr","0.0.0.0:3000","."]