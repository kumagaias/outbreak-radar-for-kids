FROM public.ecr.aws/lambda/nodejs:20

# Copy package files
COPY package*.json ${LAMBDA_TASK_ROOT}/

# Install production dependencies only
RUN npm ci --production --omit=dev

# Copy application code
COPY index.js ${LAMBDA_TASK_ROOT}/
COPY lib/ ${LAMBDA_TASK_ROOT}/lib/

# Set the CMD to your handler
CMD [ "index.handler" ]
