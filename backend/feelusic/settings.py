import os
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv
from mongoengine import connect

# Load biến môi trường
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------- Django default DB (cho sessions, auth, admin site)
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# 🔑 Secret key
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "unsafe-secret-key")

# ⚠️ Debug: luôn False khi production
DEBUG = os.environ.get("DEBUG", "False") == "True"

# 🌍 Hosts
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "*").split(",")

# Ứng dụng
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "recommend",
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = True

ROOT_URLCONF = "feelusic.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "feelusic.wsgi.application"


# ========================
# 📌 MongoDB Local connect
# ========================

# Kết nối pymongo (dùng cho raw queries)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/feelusic_db")
client = MongoClient(MONGODB_URI)
db = client["feelusic_db"]

# Kết nối mongoengine (dùng cho Document models)
connect(
    db="feelusic_db",
    host="mongodb://127.0.0.1:27017/feelusic_db"
)


# 🔐 Password validators
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# 🌎 I18N
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# 📂 Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
