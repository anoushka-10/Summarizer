FROM public.ecr.aws/lambda/nodejs:18

# Copy package files first (for better caching)
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy your application code
COPY . .

# The CMD points to your handler function
# Format: filename.functionName
CMD ["lambda-handler.handler"]
