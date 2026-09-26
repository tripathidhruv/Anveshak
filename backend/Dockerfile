# KAIZEN backend — FastAPI + SQLAlchemy (SQLite by default; see docker-compose.yml comments).
#
# Base image: python:3.11-slim-bookworm, NOT an -alpine variant. Task H8 added lightgbm and
# shap to requirements.txt. Their PyPI wheels are prebuilt for manylinux/x86_64 so no compiler
# is strictly required at install time, but:
#   - lightgbm's prebuilt wheel dynamically links against libgomp (OpenMP) at *runtime*, which
#     musl-based Alpine images do not ship and cannot satisfy without a from-source rebuild.
#   - shap's some install paths (and any future non-x86_64 build, e.g. arm64 hosts) fall back
#     to building its C extension from source, which needs a real C/C++ toolchain.
# build-essential + libgomp1 are installed below so both the "prebuilt wheel" and "build from
# source" paths work, on Debian's glibc base rather than Alpine's musl.
FROM python:3.11-slim-bookworm

# libgomp1 is a runtime dependency of lightgbm's prebuilt wheel; build-essential covers the
# from-source fallback for shap (or lightgbm on architectures without a prebuilt wheel).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite database file lives at /app/kaizen.db by default (see app/config.py's
# KAIZEN_DATABASE_URL); docker-compose.yml mounts a named volume at /app so it persists across
# container recreation.
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
