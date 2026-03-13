# Use the official PostgreSQL image
FROM postgres:14-alpine

# Copy the schema initialization script
# This script will be executed automatically when the container starts
# for the first time with an empty data directory.
COPY schema.sql /docker-entrypoint-initdb.d/
