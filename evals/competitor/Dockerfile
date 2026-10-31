# Shopify Multi-Store MCP (alex-brecher/shopify-multi-store), the published npm package, in a
# container so the evals run it without access to this computer's files or keychain.
FROM node:22-slim
ARG VERSION=2.0.3
RUN npm install -g --ignore-scripts shopify-multi-store-mcp-server@${VERSION} && npm cache clean --force
ENTRYPOINT ["shopify-multi-store"]
CMD ["start"]
