# Chọn image Python
FROM python:3.12-slim

# Tạo thư mục app
WORKDIR /app

# Copy file requirements.txt vào
COPY requirements.txt .

# Cài đặt dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ project vào container
COPY . .

# Set biến môi trường Django
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=feelusic.settings

# Expose port (Railway sẽ override bằng $PORT)
EXPOSE 8000

# Chạy Gunicorn
CMD gunicorn backend.feelusic.wsgi:application --chdir backend --bind 0.0.0.0:$PORT
