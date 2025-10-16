from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import bcrypt
import logging
import tensorflow as tf
import numpy as np
import cv2
import pandas as pd
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
from .models import UserProfile, EmotionHistory
from bson.objectid import ObjectId
import re
import os
from dotenv import load_dotenv
import traceback
# Cấu hình logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
from mongoengine.queryset.visitor import Q
# Load biến môi trường
client = MongoClient("mongodb://localhost:27017/")
db = client['feelusic_db'] 

# Kết nối MongoDB
try:
    client = MongoClient("mongodb://localhost:27017")
    client.admin.command('ping')
    db = client['feelusic_db']
    history_collection = db['emotion_history']
    songs_collection = db['songs']
    artists_collection = db['artists']
    albums_collection = db['albums']
    historysongs_collection = db['historysongs']
    historylists_collection = db['historylists']
    loginhistory_collection = db['loginhistory']
    users_collection = db["userprofile"]
    logger.debug("Kết nối MongoDB thành công!")
except ConnectionFailure as e:
    logger.error(f"Lỗi kết nối MongoDB: {e}")
    raise e


# Load mô hình Keras
try:
    model = tf.keras.models.load_model('model/emotion.keras')
    logger.debug("Mô hình được tải thành công!")
    logger.debug(f"Input shape of model: {model.input_shape}")
    logger.debug(f"Output shape of model: {model.output_shape}")
except Exception as e:
    logger.error(f"Lỗi tải mô hình: {e}")
    model = None
    raise

# Định nghĩa 7 lớp của mô hình
model_emotions = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
# Ánh xạ 7 lớp về 3 lớp
emotion_mapping = {
    'angry': 'sad',
    'disgust': 'sad',
    'fear': 'sad',
    'happy': 'happy',
    'sad': 'sad',
    'surprise': 'happy',
    'neutral': 'neutral'
}
# Danh sách 3 cảm xúc cuối cùng
final_emotions = ['happy', 'sad', 'neutral']
IMG_SIZE = 48

# Tải dữ liệu từ songs
try:
    songs_data = pd.DataFrame(list(songs_collection.find()), columns=[
        'title', 'artist', 'genre', 'emotion', 'bpm', 'file_path', 'cover'
    ]).fillna({'file_path': '', 'cover': ''})
    songs_data = songs_data[songs_data['emotion'].str.lower().isin([e.lower() for e in final_emotions])]
    logger.debug(f"Đã tải {len(songs_data)} bài hát từ songs_collection với 3 cảm xúc.")
except Exception as e:
    logger.error(f"Lỗi tải songs_data: {e}")
    songs_data = pd.DataFrame()

def recommend_songs(emotion, top_k=30):
    if songs_data.empty:
        logger.warning("Không có bài hát trong songs_data, trả về playlist rỗng.")
        return []
    filtered_songs = songs_data[songs_data['emotion'].str.lower() == emotion.lower()]
    if filtered_songs.empty:
        filtered_songs = songs_data[songs_data['emotion'].str.lower().isin([e.lower() for e in final_emotions])]
    features = filtered_songs[['bpm']].values
    if len(features) > 1:
        similarity = cosine_similarity(features)
        indices = np.argsort(similarity.mean(axis=1))[-top_k:][::-1]
    else:
        indices = range(min(top_k, len(filtered_songs)))
    playlist = filtered_songs.iloc[indices][['title', 'artist', 'genre', 'file_path', 'cover']].to_dict('records')
    for song in playlist:
        if song['file_path'] and not song['file_path'].startswith('/'):
            song['file_path'] = f"/{song['file_path']}"
        logger.debug(f"Adjusted song: {song}")
    return playlist

@api_view(['POST'])
def register(request):
    try:
        data = request.data
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        phone = data.get('phone')

        if not username or not password:
            return Response({'message': 'Thiếu username hoặc password'}, status=400)

        # Kiểm tra username tồn tại
        if users_collection.find_one({"username": username}):
            return Response({'message': 'Tên đăng nhập đã tồn tại'}, status=400)

        # Kiểm tra email tồn tại
        if email and users_collection.find_one({"email": email}):
            return Response({'message': 'Email đã tồn tại'}, status=400)

        # Hash mật khẩu
        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Tạo user mới
        new_user = {
            "username": username,
            "email": email,
            "password": hashed_pw,
            "phone": phone
        }
        result = users_collection.insert_one(new_user)

        return Response({
            'message': 'Đăng ký thành công',
            'userId': str(result.inserted_id),
            'username': username
        }, status=201)

    except Exception as e:
        logger.error(f"Lỗi server khi đăng ký: {e}")
        return Response({'message': f"Lỗi server: {e}"}, status=500)


@api_view(['POST'])
def login_view(request):
    try:
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({'message': 'Vui lòng nhập username và password!'}, status=400)

        # Tìm user trong recommend_userprofile
        user = users_collection.find_one({'username': username})
        if not user:
            return Response({'message': 'Người dùng không tồn tại!'}, status=400)

        # Kiểm tra mật khẩu
        if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return Response({'message': 'Mật khẩu sai!'}, status=400)

        user_id = str(user['_id'])

        # Ghi lịch sử đăng nhập
        device = request.headers.get('User-Agent', 'Unknown Device')
        loginhistory_collection.update_one(
            {'userId': user_id},
            {
                '$set': {'username': username},
                '$push': {
                    'logins': {
                        'timestamp': datetime.utcnow(),
                        'device': device
                    }
                }
            },
            upsert=True
        )

        return Response({
            'message': 'Đăng nhập thành công!',
            'userId': user_id,
            'username': username
        }, status=200)

    except Exception as e:
        logger.error(f"Lỗi đăng nhập: {e}")
        return Response({'message': f"Lỗi server: {e}"}, status=500)

from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.core.mail import send_mail
from django.conf import settings
from pymongo import MongoClient
import random
import string
from django.core.cache import cache
import bcrypt
from difflib import SequenceMatcher
from datetime import datetime
import logging
@api_view(['POST'])
def forgot_password_view(request):
    try:
        email = request.data.get('email')
        if not email:
            return Response({'message': 'Vui lòng nhập email!'}, status=400)

        # Tìm user trong users_collection
        user = users_collection.find_one({'email': email})
        if not user:
            return Response({'message': 'Không tìm thấy người dùng với email này!'}, status=404)

        # Tạo OTP
        otp = ''.join(random.choices(string.digits, k=6))
        cache.set(f"otp_{email}", otp, timeout=300)  # Lưu OTP trong 5 phút

        # Gửi OTP qua email (in ra console)
        send_mail(
            subject='Yêu cầu đặt lại mật khẩu',
            message=f'Mã OTP của bạn để đặt lại mật khẩu là: {otp}\nMã này có hiệu lực trong 5 phút.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response({'message': 'Mã OTP đã được gửi (kiểm tra console)!'}, status=200)

    except Exception as e:
        logger.error(f"Lỗi gửi OTP: {e}")
        return Response({'message': f"Lỗi server: {e}"}, status=500)

@api_view(['POST'])
def verify_otp_view(request):
    try:
        email = request.data.get('email')
        otp = request.data.get('otp')
        new_password = request.data.get('newPassword')

        if not all([email, otp, new_password]):
            return Response({'message': 'Vui lòng nhập đầy đủ email, OTP và mật khẩu mới!'}, status=400)

        # Kiểm tra OTP
        stored_otp = cache.get(f"otp_{email}")
        if not stored_otp or stored_otp != otp:
            return Response({'message': 'Mã OTP không hợp lệ hoặc đã hết hạn!'}, status=400)

        # Tìm user trong users_collection
        user = users_collection.find_one({'email': email})
        if not user:
            return Response({'message': 'Không tìm thấy người dùng!'}, status=404)

        # Cập nhật mật khẩu mới
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        users_collection.update_one(
            {'email': email},
            {'$set': {'password': hashed_password}}
        )

        # Ghi lịch sử đặt lại mật khẩu
        user_id = str(user['_id'])
        device = request.headers.get('User-Agent', 'Unknown Device')
        loginhistory_collection.update_one(
            {'userId': user_id},
            {
                '$set': {'username': user['username']},
                '$push': {
                    'password_resets': {
                        'timestamp': datetime.utcnow(),
                        'device': device
                    }
                }
            },
            upsert=True
        )

        # Xóa OTP khỏi cache
        cache.delete(f"otp_{email}")

        return Response({'message': 'Đặt lại mật khẩu thành công!'}, status=200)

    except Exception as e:
        logger.error(f"Lỗi xác thực OTP: {e}")
        return Response({'message': f"Lỗi server: {e}"}, status=500)
@api_view(['POST'])
def predict_emotion(request):
    try:
        # Kiểm tra mô hình
        if model is None:
            logger.error("Mô hình không được tải, sử dụng cảm xúc mặc định 'neutral'")
            try:
                EmotionHistory(
                    username='anonymous',
                    emotion='neutral',
                    confidence=0.0,
                    timestamp=datetime.now().isoformat()
                ).save()
                save_message = "Mô hình không khả dụng, đã lưu lịch sử với cảm xúc mặc định"
            except Exception as e:
                logger.error(f"Lỗi lưu vào MongoDB khi mô hình None: {e}\n{traceback.format_exc()}")
                save_message = f"Mô hình không khả dụng, không thể lưu lịch sử: {str(e)}"
            return Response({
                'error': 'Mô hình không được tải, sử dụng emotion mặc định',
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral'),
                'message': save_message
            }, status=status.HTTP_200_OK)

        # Kiểm tra ảnh
        if 'image' not in request.FILES:
            logger.error("Không có ảnh được gửi trong request")
            return Response({
                'error': 'Không có ảnh được gửi',
                'message': 'Vui lòng gửi một hình ảnh để nhận dạng cảm xúc'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Lấy username hoặc userId từ request
        username = request.data.get('username', None)
        user_id = request.data.get('userId', None)
        logger.debug(f"Request data: username={username}, userId={user_id}")

        # Xác thực người dùng
        user = None
        if user_id and user_id not in ['None', 'null', 'undefined']:
            try:
                user = UserProfile.objects(id=user_id).first()
                if user:
                    username = user.username
                    logger.debug(f"Đã tìm thấy username={username} từ userId={user_id}")
                else:
                    logger.warning(f"Không tìm thấy người dùng với userId={user_id}")
            except Exception as e:
                logger.error(f"Lỗi khi truy vấn UserProfile với userId={user_id}: {e}\n{traceback.format_exc()}")
        elif username:
            user = UserProfile.objects(username=username).first()
            if user:
                logger.debug(f"Đã tìm thấy người dùng với username={username}")
            else:
                logger.warning(f"Không tìm thấy người dùng với username={username}")
                return Response({
                    'error': 'Tên người dùng không tồn tại',
                    'message': 'Vui lòng cung cấp username hợp lệ hoặc đăng nhập lại'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            username = 'anonymous'
            logger.warning("Không có username hoặc userId trong request, sử dụng 'anonymous'")

        # Đọc và xử lý ảnh
        image_file = request.FILES['image']
        image_data = np.frombuffer(image_file.read(), np.uint8)
        image = cv2.imdecode(image_data, cv2.IMREAD_GRAYSCALE)
        logger.debug(f"Ảnh đầu vào shape: {image.shape if image is not None else 'None'}")
        if image is None:
            logger.error("Không thể đọc được ảnh từ dữ liệu gửi lên")
            try:
                EmotionHistory(
                    username=username,
                    emotion='neutral',
                    confidence=0.0,
                    timestamp=datetime.now().isoformat()
                ).save()
                save_message = f"Không đọc được ảnh, đã lưu lịch sử với cảm xúc mặc định cho người dùng {username}"
            except Exception as e:
                logger.error(f"Lỗi lưu vào MongoDB khi ảnh None: {e}\n{traceback.format_exc()}")
                save_message = f"Không đọc được ảnh, không thể lưu lịch sử: {str(e)}"
            return Response({
                'error': 'Không đọc được ảnh',
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral'),
                'message': save_message
            }, status=status.HTTP_400_BAD_REQUEST)

        # Phát hiện khuôn mặt
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(image, scaleFactor=1.1, minNeighbors=4)
        logger.debug(f"Số khuôn mặt phát hiện: {len(faces)}")
        if len(faces) == 0:
            logger.debug("Không phát hiện khuôn mặt, sử dụng cảm xúc mặc định 'neutral'")
            try:
                EmotionHistory(
                    username=username,
                    emotion='neutral',
                    confidence=0.0,
                    timestamp=datetime.now().isoformat()
                ).save()
                save_message = f"Không phát hiện khuôn mặt, đã lưu lịch sử với cảm xúc mặc định cho người dùng {username}"
            except Exception as e:
                logger.error(f"Lỗi lưu vào MongoDB khi không phát hiện khuôn mặt: {e}\n{traceback.format_exc()}")
                save_message = f"Không phát hiện khuôn mặt, không thể lưu lịch sử: {str(e)}"
            return Response({
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral'),
                'message': save_message
            }, status=status.HTTP_200_OK)

        # Xử lý ảnh để đưa vào mô hình
        image = cv2.resize(image, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
        if image.shape != (IMG_SIZE, IMG_SIZE):
            logger.error(f"Kích thước ảnh sau resize không đúng: {image.shape}")
            try:
                EmotionHistory(
                    username=username,
                    emotion='neutral',
                    confidence=0.0,
                    timestamp=datetime.now().isoformat()
                ).save()
                save_message = f"Lỗi xử lý ảnh, đã lưu lịch sử với cảm xúc mặc định cho người dùng {username}"
            except Exception as e:
                logger.error(f"Lỗi lưu vào MongoDB khi resize ảnh thất bại: {e}\n{traceback.format_exc()}")
                save_message = f"Lỗi xử lý ảnh, không thể lưu lịch sử: {str(e)}"
            return Response({
                'error': 'Kích thước ảnh sau resize không đúng',
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral'),
                'message': save_message
            }, status=status.HTTP_400_BAD_REQUEST)

        image = image / 255.0
        image = np.expand_dims(image, axis=[0, -1])
        logger.debug(f"Hình ảnh sau xử lý shape: {image.shape}")

        # Dự đoán cảm xúc
        prediction = model.predict(image, verbose=0)
        logger.debug(f"Dự đoán thô: {prediction}")
        if prediction.size == 0 or len(prediction.shape) < 2:
            logger.error(f"Dự đoán không hợp lệ, shape: {prediction.shape}")
            try:
                EmotionHistory(
                    username=username,
                    emotion='neutral',
                    confidence=0.0,
                    timestamp=datetime.now().isoformat()
                ).save()
                save_message = f"Dự đoán không hợp lệ, đã lưu lịch sử với cảm xúc mặc định cho người dùng {username}"
            except Exception as e:
                logger.error(f"Lỗi lưu vào MongoDB khi dự đoán thất bại: {e}\n{traceback.format_exc()}")
                save_message = f"Dự đoán không hợp lệ, không thể lưu lịch sử: {str(e)}"
            return Response({
                'error': 'Dự đoán không hợp lệ',
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral'),
                'message': save_message
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        emotion_idx = np.argmax(prediction[0])
        logger.debug(f"Chỉ số cảm xúc: {emotion_idx}, Giá trị: {prediction[0][emotion_idx]}")
        if emotion_idx >= len(model_emotions) or emotion_idx < 0:
            logger.error(f"Chỉ số cảm xúc không hợp lệ: {emotion_idx}")
            try:
                EmotionHistory(
                    username=username,
                    emotion='neutral',
                    confidence=0.0,
                    timestamp=datetime.now().isoformat()
                ).save()
                save_message = f"Chỉ số cảm xúc không hợp lệ, đã lưu lịch sử với cảm xúc mặc định cho người dùng {username}"
            except Exception as e:
                logger.error(f"Lỗi lưu vào MongoDB khi chỉ số cảm xúc không hợp lệ: {e}\n{traceback.format_exc()}")
                save_message = f"Chỉ số cảm xúc không hợp lệ, không thể lưu lịch sử: {str(e)}"
            return Response({
                'error': 'Chỉ số cảm xúc không hợp lệ',
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral'),
                'message': save_message
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Ánh xạ cảm xúc
        model_emotion = model_emotions[emotion_idx]
        final_emotion = emotion_mapping[model_emotion]
        confidence = float(prediction[0][emotion_idx])
        logger.debug(f"Mô hình emotion: {model_emotion}, Final emotion: {final_emotion}, Confidence: {confidence}")

        # Gợi ý playlist
        playlist = recommend_songs(final_emotion) if not songs_data.empty else []
        logger.debug(f"Playlist gợi ý: {len(playlist)} bài hát cho cảm xúc {final_emotion}")

        # Lưu vào emotion_history
        try:
            if not all([username, final_emotion, confidence is not None]):
                logger.error(f"Dữ liệu đầu vào không hợp lệ: username={username}, emotion={final_emotion}, confidence={confidence}")
                save_message = "Nhận dạng cảm xúc thành công nhưng không thể lưu lịch sử: Dữ liệu đầu vào không hợp lệ"
            else:
                timestamp = datetime.now().isoformat()
                emotion_history = EmotionHistory(
                    username=username,
                    emotion=final_emotion,
                    confidence=confidence,
                    timestamp=timestamp
                )
                emotion_history.save()
                logger.debug(f"Dữ liệu đã lưu vào MongoDB: username={username}, emotion={final_emotion}, confidence={confidence}, timestamp={timestamp}")
                save_message = f"Nhận dạng cảm xúc thành công và đã lưu lịch sử cho người dùng {username}"
        except Exception as e:
            logger.error(f"Lỗi lưu vào MongoDB: {e}\nDữ liệu đầu vào: username={username}, emotion={final_emotion}, confidence={confidence}, timestamp={timestamp}\n{traceback.format_exc()}")
            save_message = f"Nhận dạng cảm xúc thành công nhưng không thể lưu lịch sử: {str(e)}"

        # Trả về phản hồi
        return Response({
            'emotion': final_emotion,
            'confidence': confidence,
            'playlist': playlist,
            'message': save_message,
            'note': 'Playlist rỗng nếu không có bài hát trong songs collection' if not playlist else ''
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Lỗi trong predict_emotion: {e}\n{traceback.format_exc()}")
        try:
            EmotionHistory(
                username=username if username else 'anonymous',
                emotion='neutral',
                confidence=0.0,
                timestamp=datetime.now().isoformat()
            ).save()
            save_message = f"Lỗi xử lý nhận dạng cảm xúc, đã lưu lịch sử với cảm xúc mặc định cho người dùng {username if username else 'anonymous'}"
        except Exception as save_e:
            logger.error(f"Lỗi lưu vào MongoDB trong khối lỗi chính: {save_e}\n{traceback.format_exc()}")
            save_message = f"Lỗi xử lý nhận dạng cảm xúc, không thể lưu lịch sử: {str(save_e)}"
        return Response({
            'error': str(e),
            'fallback_emotion': 'neutral',
            'confidence': 0.0,
            'playlist': recommend_songs('neutral'),
            'message': save_message
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@api_view(['GET'])
def test_mongo(request):
    try:
        if not client or not db:
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        test_collection = db['test_collection']
        test_collection.insert_one({'test': 'Hello MongoDB', 'timestamp': '2025-06-17'})
        data = list(test_collection.find())
        for item in data:
            item['_id'] = str(item['_id'])
        return Response({'message': 'Kết nối MongoDB thành công', 'data': data}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi trong test_mongo: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_albums(request):
    try:
        if not client or not db:
            logger.error("Không thể kết nối MongoDB")
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        albums = list(db.albums.find().limit(100))
        processed_albums = []
        for album in albums:
            logger.debug(f"Raw album data: {album}")
            album_id = str(album.get('_id', ''))
            for key, value in album.items():
                if isinstance(value, dict) and 'artist' in value and 'songs' in value:
                    title = key
                    artist = value.get('artist', 'Unknown Artist')
                    cover = value.get('cover', '/public/default_cover.png')
                    if isinstance(cover, str):
                        if cover.startswith("public\\") or cover.startswith("public/"):
                            cover = '/' + cover.replace('\\', '/').removeprefix('public/')
                        if not cover.lower().endswith(('.png', '.jpg', '.jpeg')):
                            cover = '/public/default_cover.png'
                    else:
                        cover = '/public/default_cover.png'
                    songs = value.get('songs', [])
                    for song in songs:
                        if 'cover' in song and song['cover'].startswith("public\\"):
                            song['cover'] = '/' + song['cover'].replace('\\', '/').removeprefix('public/')
                        if 'src' in song and song['src'].startswith("public\\"):
                            song['file_path'] = '/' + song['src'].replace('\\', '/').removeprefix('public/')
                    processed_albums.append({
                        '_id': album_id,
                        'title': title,
                        'artist': artist,
                        'cover': cover,
                        'songs': songs
                    })
                    logger.debug(f"Processed album: {title}, artist: {artist}, songs: {len(songs)}")
        logger.info(f"Đã lấy và chuẩn hóa {len(processed_albums)} album")
        return Response({
            'message': 'Lấy album thành công',
            'count': len(processed_albums),
            'data': processed_albums
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy album: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_list(request):
    try:
        if not client or not db:
            logger.error("Không thể kết nối MongoDB")
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        raw_documents = list(db.list.find().limit(100))
        list_ = []
        for doc in raw_documents:
            logger.debug(f"Raw document data: {doc}")
            list_id = str(doc.get('_id', ''))
            for key, value in doc.items():
                if isinstance(value, dict) and 'artist' in value and 'songs' in value:
                    title = key
                    artist = value.get('artist', 'Unknown Artist')
                    cover = value.get('cover', '/public/default_cover.png')
                    if isinstance(cover, str):
                        if cover.startswith("public\\") or cover.startswith("public/"):
                            cover = '/' + cover.replace('\\', '/').removeprefix('public/')
                        if not cover.lower().endswith(('.png', '.jpg', '.jpeg')):
                            cover = '/public/default_cover.png'
                    else:
                        cover = '/public/default_cover.png'
                    songs = value.get('songs', [])
                    for song in songs:
                        if 'cover' in song and song['cover'].startswith("public\\"):
                            song['cover'] = '/' + song['cover'].replace('\\', '/').removeprefix('public/')
                        if 'src' in song and song['src'].startswith("public\\"):
                            song['file_path'] = '/' + song['src'].replace('\\', '/').removeprefix('public/')
                    list_.append({
                        '_id': list_id,
                        'title': title,
                        'artist': artist,
                        'cover': cover,
                        'songs': songs
                    })
                    logger.debug(f"Processed list item: {title}, artist: {artist}, songs: {len(songs)}")
        logger.info(f"Đã lấy và chuẩn hóa {len(list_)} danh sách phát")
        return Response({
            'message': 'Lấy danh sách phát thành công',
            'count': len(list_),
            'data': list_
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy danh sách phát: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from bson import ObjectId
from datetime import datetime
import logging

from .models import UserProfile  # chỉnh đúng đường dẫn nếu cần


logger = logging.getLogger(__name__)

@api_view(['POST'])
def add_historysong(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.error(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.error(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        logger.debug(f"Received data for add_historysong: {data}, user_id: {user_id}")

        if not all(key in data for key in ['title', 'artist', 'file_path']):
            logger.error(f"Missing required fields: {data}")
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        normalized_title = data.get('title', '').strip().lower()
        normalized_artist = data.get('artist', 'Unknown Artist').strip().lower()
        file_path = data.get('file_path', '')
        if file_path and not file_path.startswith('/'):
            file_path = f"/{file_path}"
            logger.debug(f"Normalized file_path: {file_path}")

        # Tìm lịch sử cũ của người dùng
        history = historysongs_collection.find_one({'userId': user_id})
        songs = history.get('songs', []) if history else []

        # Xóa bài hát trùng (theo title + file_path)
        songs = [s for s in songs if not (
            s['title'].strip().lower() == normalized_title and
            s['file_path'] == file_path
        )]

        # Thêm bài mới lên đầu
        new_song = {
            'title': data.get('title', ''),
            'artist': data.get('artist', 'Unknown Artist'),
            'file_path': file_path,
            'cover': data.get('cover', '/public/default_cover.png'),
            'listenedAt': datetime.now()
        }
        songs.insert(0, new_song)

        # Giữ lại tối đa 10 bài
        songs = songs[:10]

        # Cập nhật lại document
        history_data = {
            'userId': user_id,
            'username': username,
            'songs': songs
        }
        historysongs_collection.replace_one({'userId': user_id}, history_data, upsert=True)

        logger.info(f"Đã thêm hoặc cập nhật bài hát trong lịch sử: {normalized_title}")
        return Response({'message': 'Thêm bài hát vào lịch sử thành công'}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Lỗi khi thêm bài hát vào lịch sử: {user_id} - {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def add_historylist(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.error(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.error(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)
        
        data = request.data
        logger.debug(f"Received data for add_historylist: {data}, user_id: {user_id}")
        if not all(key in data for key in ['title', 'artist', 'songs']):
            logger.error(f"Missing required fields: {data}")
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
        
        username = user.username
        normalized_title = data.get('title', '').strip().lower()
        normalized_artist = data.get('artist', 'Unknown Artist').strip().lower()
        songs = data.get('songs', [])
        song_srcs = [s['src'] for s in songs if 'src' in s]
        
        history = historylists_collection.find_one({'userId': user_id})
        if history and any(
            l['title'].strip().lower() == normalized_title and
            [s['src'] for s in l['songs']] == song_srcs
            for l in history.get('lists', [])
        ):
            logger.info(f"Danh sách đã tồn tại: {normalized_title}")
            return Response({'message': 'Danh sách đã tồn tại trong lịch sử'}, status=status.HTTP_200_OK)
        
        if not history:
            history = {'userId': user_id, 'username': username, 'lists': []}
        history['lists'].insert(0, {
            'title': data.get('title', ''),
            'artist': data.get('artist', 'Unknown Artist'),
            'cover': data.get('cover', '/public/default_cover.png'),
            'songs': songs,
            'listenedAt': datetime.now()
        })
        history['lists'] = history['lists'][:10]
        historylists_collection.replace_one({'userId': user_id}, history, upsert=True)
        logger.info(f"Thêm danh sách thành công: {normalized_title}")
        return Response({'message': 'Thêm danh sách vào lịch sử thành công'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi thêm danh sách vào lịch sử: {user_id} - {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_historylists(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.error(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.error(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)
        
        history = historylists_collection.find_one({'userId': user_id})
        lists = history.get('lists', []) if history else []
        processed_lists = []
        for item in lists:
            songs = item.get('songs', [])
            for song in songs:
                if 'src' in song and song['src'].startswith("public\\"):
                    song['src'] = '/' + song['src'].replace('\\', '/').removeprefix('public/')
                if 'cover' in song and song['cover'].startswith("public\\"):
                    song['cover'] = '/' + song['cover'].replace('\\', '/').removeprefix('public/')
            cover = item.get('cover', '/public/default_cover.png')
            if cover.startswith("public\\") or cover.startswith("public/"):
                cover = '/' + cover.replace('\\', '/').removeprefix('public/')
            processed_lists.append({
                'title': item.get('title', ''),
                'artist': item.get('artist', 'Unknown Artist'),
                'cover': cover,
                'songs': songs,
                'listenedAt': item.get('listenedAt', '').isoformat() if item.get('listenedAt') else ''
            })
        lists = sorted(processed_lists, key=lambda x: x.get('listenedAt', datetime.min), reverse=True)
        logger.debug(f"Lấy lịch sử danh sách cho user {user_id}: {len(lists)} item")
        return Response({
            'message': 'Lấy lịch sử danh sách thành công',
            'data': {'lists': lists}
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy lịch sử danh sách: {user_id} - {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_historysongs(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.error(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.error(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)
        
        history = historysongs_collection.find_one({'userId': user_id})
        songs = history.get('songs', []) if history else []
        processed_songs = []
        for song in songs:
            file_path = song.get('file_path', '')
            if file_path.startswith("public\\") or file_path.startswith("public/"):
                file_path = '/' + file_path.replace('\\', '/').removeprefix('public/')
            cover = song.get('cover', '/public/default_cover.png')
            if cover.startswith("public\\") or cover.startswith("public/"):
                cover = '/' + cover.replace('\\', '/').removeprefix('public/')
            processed_songs.append({
                'title': song.get('title', ''),
                'artist': song.get('artist', 'Unknown Artist'),
                'file_path': file_path,
                'cover': cover,
                'listenedAt': song.get('listenedAt', '').isoformat() if song.get('listenedAt') else ''
            })
        songs = sorted(processed_songs, key=lambda x: x.get('listenedAt', datetime.min), reverse=True)
        logger.debug(f"Lấy lịch sử bài hát cho user {user_id}: {len(songs)} item")
        return Response({
            'message': 'Lấy lịch sử bài hát thành công',
            'data': {'songs': songs}
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy lịch sử bài hát: {user_id} - {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_login_history(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        # Truy vấn trực tiếp bằng string userId
        history = loginhistory_collection.find_one({'userId': str(user_id)})
        if not history:
            return Response({'logins': []}, status=status.HTTP_200_OK)

        # Convert ObjectId và datetime
        history["_id"] = str(history["_id"])
        for log in history.get("logins", []):
            if isinstance(log.get("timestamp"), datetime):
                log["timestamp"] = log["timestamp"].isoformat()

        return Response(history, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@api_view(['GET'])
def get_artists(request):
    try:
        if not client or not db:
            logger.error("Không thể kết nối MongoDB")
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        artists = list(artists_collection.find().limit(100))
        processed_artists = []
        for artist in artists:
            logger.debug(f"Raw artist data: {artist}")
            artist_id = str(artist.get('_id', ''))
            cover = artist.get('cover', '/public/default_cover.png')
            cover2 = artist.get('cover2', '/public/default_cover.png')
            if isinstance(cover, str):
                if cover.startswith("public\\") or cover.startswith("public/"):
                    cover = '/' + cover.replace('\\', '/').removeprefix('public/')
                if not cover.lower().endswith(('.png', '.jpg', '.jpeg')):
                    cover = '/public/default_cover.png'
            if isinstance(cover2, str):
                if cover2.startswith("public\\") or cover2.startswith("public/"):
                    cover2 = '/' + cover2.replace('\\', '/').removeprefix('public/')
                if not cover2.lower().endswith(('.png', '.jpg', '.jpeg')):
                    cover2 = '/public/default_cover.png'
            processed_artists.append({
                '_id': artist_id,
                'artist': artist.get('artist', 'Unknown Artist'),
                'cover': cover,
                'cover2': cover2,
                'albums': [str(album_id) for album_id in artist.get('albums', [])]
            })
            logger.debug(f"Processed artist: {artist.get('artist')}, albums: {len(artist.get('albums', []))}")
        logger.info(f"Đã lấy và chuẩn hóa {len(processed_artists)} nghệ sĩ")
        return Response({
            'message': 'Lấy danh sách nghệ sĩ thành công',
            'count': len(processed_artists),
            'data': processed_artists
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy danh sách nghệ sĩ: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_artist_albums(request, artist_id):
    try:
        if not client or not db:
            logger.error("Không thể kết nối MongoDB")
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        albums = list(albums_collection.find({'artistId': ObjectId(artist_id)}).limit(100))
        processed_albums = []
        for album in albums:
            logger.debug(f"Raw album data: {album}")
            album_id = str(album.get('_id', ''))
            cover = album.get('cover', '/public/default_cover.png')
            if isinstance(cover, str):
                if cover.startswith("public\\") or cover.startswith("public/"):
                    cover = '/' + cover.replace('\\', '/').removeprefix('public/')
                if not cover.lower().endswith(('.png', '.jpg', '.jpeg')):
                    cover = '/public/default_cover.png'
            songs = album.get('songs', [])
            for song in songs:
                if 'cover' in song and song['cover'].startswith("public\\"):
                    song['cover'] = '/' + song['cover'].replace('\\', '/').removeprefix('public/')
                if 'file_path' in song and song['file_path'].startswith("public\\"):
                    song['file_path'] = '/' + song['file_path'].replace('\\', '/').removeprefix('public/')
            processed_albums.append({
                '_id': album_id,
                'title': album.get('title', 'Unknown Title'),
                'artist': album.get('artist', 'Unknown Artist'),
                'cover': cover,
                'songs': songs
            })
            logger.debug(f"Processed album: {album.get('title')}, songs: {len(songs)}")
        logger.info(f"Đã lấy và chuẩn hóa {len(processed_albums)} album cho artist {artist_id}")
        return Response({
            'message': 'Lấy album của nghệ sĩ thành công',
            'count': len(processed_albums),
            'data': processed_albums
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy album của nghệ sĩ: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_update_artist(request):
    try:
        if not client or not db:
            logger.error("Không thể kết nối MongoDB")
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = request.data
        _id = data.get('_id')
        artist_doc = artists_collection.find_one({'_id': ObjectId(_id)}) if _id else None
        if artist_doc:
            artists_collection.update_one(
                {'_id': ObjectId(_id)},
                {
                    '$set': {
                        'artist': data.get('artist', 'Unknown Artist'),
                        'cover': data.get('cover', '/public/default_cover.png'),
                        'cover2': data.get('cover2', '/public/default_cover.png'),
                        'albums': [ObjectId(album_id) for album_id in data.get('albums', [])],
                        'updatedAt': datetime.now()
                    }
                }
            )
            artist_doc = artists_collection.find_one({'_id': ObjectId(_id)})
        else:
            artist_doc = {
                '_id': ObjectId(_id) if _id else ObjectId(),
                'artist': data.get('artist', 'Unknown Artist'),
                'cover': data.get('cover', '/public/default_cover.png'),
                'cover2': data.get('cover2', '/public/default_cover.png'),
                'albums': [ObjectId(album_id) for album_id in data.get('albums', [])],
                'createdAt': datetime.now(),
                'updatedAt': datetime.now()
            }
            artists_collection.insert_one(artist_doc)
        artist_doc['_id'] = str(artist_doc['_id'])
        logger.info(f"Tạo/cập nhật nghệ sĩ thành công: {artist_doc['artist']}")
        return Response({'message': 'Tạo/cập nhật nghệ sĩ thành công', 'data': artist_doc}, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Lỗi khi tạo/cập nhật nghệ sĩ: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_album(request):
    try:
        if not client or not db:
            logger.error("Không thể kết nối MongoDB")
            return Response({'error': 'Không thể kết nối MongoDB'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        data = request.data
        _id = data.get('_id')
        artist_name = data.get('artist')
        artist_doc = artists_collection.find_one({'artist': artist_name})
        if not artist_doc:
            artist_doc = {
                '_id': ObjectId(),
                'artist': artist_name,
                'cover': data.get('cover', '/public/default_cover.png'),
                'cover2': data.get('cover', '/public/default_cover.png'),
                'albums': [],
                'createdAt': datetime.now(),
                'updatedAt': datetime.now()
            }
            artists_collection.insert_one(artist_doc)
        else:
            artist_doc = artists_collection.find_one({'artist': artist_name})
        album_doc = {
            '_id': ObjectId(_id) if _id else ObjectId(),
            'title': data.get('title', 'Unknown Title'),
            'artist': artist_name,
            'artistId': artist_doc['_id'],
            'cover': data.get('cover', '/public/default_cover.png'),
            'songs': [{**song, 'artistId': artist_doc['_id']} for song in data.get('songs', [])],
            'createdAt': datetime.now(),
            'updatedAt': datetime.now()
        }
        albums_collection.insert_one(album_doc)
        artists_collection.update_one(
            {'_id': artist_doc['_id']},
            {'$push': {'albums': album_doc['_id']}, '$set': {'updatedAt': datetime.now()}}
        )
        album_doc['_id'] = str(album_doc['_id'])
        logger.info(f"Tạo album thành công: {album_doc['title']}")
        return Response({'message': 'Tạo album thành công', 'data': album_doc}, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Lỗi khi tạo album: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_user(request, user_id):
    try:
        # Validate ObjectId
        if not user_id or user_id in ['None', 'null', 'undefined'] or not ObjectId.is_valid(user_id):
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=ObjectId(user_id)).first()
        if not user:
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'username': user.username,
            'email': user.email or '',
            'phone': user.phone or ''
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': f'Lỗi khi lấy thông tin người dùng: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Cập nhật thông tin user
@api_view(['PUT'])
def update_user(request, user_id):
    try:
        # Validate ObjectId
        if not user_id or user_id in ['None', 'null', 'undefined'] or not ObjectId.is_valid(user_id):
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=ObjectId(user_id)).first()
        if not user:
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        update_data = {}

        # --- Email ---
        email = data.get('email')
        if email:
            if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
                return Response({'error': 'Email không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

            if UserProfile.objects(Q(email=email) & Q(id__ne=ObjectId(user_id))).first():
                return Response({'error': 'Email đã được sử dụng'}, status=status.HTTP_400_BAD_REQUEST)

            update_data['email'] = email

        # --- Phone ---
        phone = data.get('phone')
        if phone:
            if not re.match(r'^(0\d{9,10})$', phone):  # chuẩn VN: 10-11 số, bắt đầu bằng 0
                return Response({'error': 'Số điện thoại không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

            if UserProfile.objects(Q(phone=phone) & Q(id__ne=ObjectId(user_id))).first():
                return Response({'error': 'Số điện thoại đã được sử dụng'}, status=status.HTTP_400_BAD_REQUEST)

            update_data['phone'] = phone

        # --- Password ---
        password = data.get('password')
        if password:
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            update_data['password'] = hashed_password

        if not update_data:
            return Response({'error': 'Không có thông tin để cập nhật'}, status=status.HTTP_400_BAD_REQUEST)

        # Update user
        result = UserProfile.objects(id=ObjectId(user_id)).update_one(upsert=False, **update_data)
        if result == 0:
            return Response({'error': 'Không thể cập nhật thông tin'}, status=status.HTTP_400_BAD_REQUEST)

        updated_user = UserProfile.objects(id=ObjectId(user_id)).first()
        return Response({
            'message': 'Cập nhật thành công',
            'username': updated_user.username,
            'email': updated_user.email or '',
            'phone': updated_user.phone or ''
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': f'Lỗi khi cập nhật thông tin: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
@api_view(['GET'])
def songs_by_artist(request):
    try:
        artist = request.GET.get('artist', '').strip()
        if not artist:
            logger.warning("Thiếu tham số artist trong yêu cầu")
            return Response({'error': 'Thiếu tên nghệ sĩ'}, status=status.HTTP_400_BAD_REQUEST)

        regex = re.compile(f'.*{re.escape(artist)}.*', re.IGNORECASE)
        query = {
            '$or': [
                {'artist': regex},
                {'artist': {'$in': [artist]}}
            ]
        }
        songs = list(songs_collection.find(query).limit(20))
        processed_songs = [
            {
                '_id': str(song['_id']),
                'title': song.get('title', ''),
                'artist': song.get('artist', ''),
                'file_path': song.get('file_path', '/public/default_song.mp3'),
                'cover': song.get('cover', '/public/default_cover.png'),
            } for song in songs
        ]
        logger.info(f"Lấy bài hát cho nghệ sĩ '{artist}': {len(processed_songs)} bài")
        return Response({
            'message': 'Lấy bài hát theo nghệ sĩ thành công',
            'data': processed_songs
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy bài hát theo nghệ sĩ '{artist}': {e}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def search(request):
    try:
        query = request.GET.get('query', '').strip()
        if not query:
            return Response({'error': 'Thiếu truy vấn tìm kiếm'}, status=status.HTTP_400_BAD_REQUEST)

        songs = list(songs_collection.find({
            '$or': [
                {'title': {'$regex': query, '$options': 'i'}},
                {'artist': {'$regex': query, '$options': 'i'}}
            ]
        }).limit(20))
        processed_songs = [
            {
                '_id': str(song['_id']),
                'type': 'song',
                'name': f"{song['title']} - {song['artist']}",
                'title': song.get('title', ''),
                'artist': song.get('artist', 'Unknown Artist'),
                'cover': song.get('cover', '/public/default_cover.png'),
                'file_path': song.get('file_path', '')
            } for song in songs
        ]

        artists = list(artists_collection.find({
            'artist': {'$regex': query, '$options': 'i'}
        }).limit(10))
        processed_artists = [
            {
                '_id': str(artist['_id']),
                'type': 'artist',
                'name': artist.get('artist', 'Unknown Artist'),
                'artist': artist.get('artist', 'Unknown Artist'),
                'cover': artist.get('cover', '/public/default_cover.png'),
                'cover2': artist.get('cover2', '/public/default_cover.png')
            } for artist in artists
        ]

        combined_results = (processed_songs + processed_artists)[:20]
        logger.info(f"Tìm kiếm với query '{query}': {len(combined_results)} kết quả")
        return Response({
            'message': 'Tìm kiếm thành công',
            'count': len(combined_results),
            'data': combined_results
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi tìm kiếm: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def songs_by_genre(request):
    try:
        genre_param = request.GET.get('genre', '').strip()
        if not genre_param:
            logger.warning("Thiếu tham số genre trong yêu cầu")
            return Response({'error': 'Thiếu thể loại'}, status=status.HTTP_400_BAD_REQUEST)

        genre_list = [g.strip() for g in genre_param.split(',') if g.strip()]
        if not genre_list:
            return Response({'error': 'Không có thể loại hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

        regex_list = [re.compile(rf'\b{re.escape(genre)}\b', re.IGNORECASE) for genre in genre_list]
        songs = list(songs_collection.find({'genre': {'$in': regex_list}}).limit(100))
        processed_songs = [
            {
                '_id': str(song['_id']),
                'title': song.get('title', ''),
                'artist': song.get('artist', ''),
                'genre': song.get('genre', ''),
                'file_path': song.get('file_path', '/public/default_song.mp3'),
                'cover': song.get('cover', '/public/default_cover.png'),
            } for song in songs
        ]
        logger.info(f"Lấy bài hát theo thể loại {genre_list}: {len(processed_songs)} bài")
        return Response({
            'message': f'Lấy bài hát theo thể loại {genre_list} thành công',
            'data': processed_songs
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy bài hát theo thể loại: {str(e)}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    
def json_serial(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError("Type not serializable")

@api_view(['GET'])
def get_my_playlist(request, user_id):
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['feelusic_db']
        collection = db['myplaylist']
        
        logger.debug(f"Fetching playlist for userId: {user_id}")
        playlist = collection.find_one({'userId': user_id})
        if not playlist:
            logger.info(f"No playlist found for userId: {user_id}")
            return Response(
                {'message': 'Không tìm thấy danh sách cá nhân', 'data': {'playlists': []}},
                status=status.HTTP_200_OK
            )
        
        playlists = playlist.get('playlists', [])
        if not isinstance(playlists, list):
            logger.error(f"Invalid playlists format for userId {user_id}: {playlists}")
            collection.update_one(
                {'userId': user_id},
                {'$set': {'playlists': []}},
                upsert=True
            )
            return Response(
                {'message': 'Không tìm thấy danh sách cá nhân', 'data': {'playlists': []}},
                status=status.HTTP_200_OK
            )

        result = {'playlists': []}
        for i, p in enumerate(playlists):
            if not isinstance(p, dict):
                logger.error(f"Invalid playlist entry at index {i} for userId {user_id}: {p}")
                continue
            result['playlists'].append({
                'title': p.get('title', f'Danh sách {i+1}'),
                'songs': p.get('songs', [])
            })
        
        logger.debug(f"Processed playlists for userId {user_id}: {result}")
        return Response(
            {'message': 'Lấy danh sách cá nhân thành công', 'data': result},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        logger.error(f"Error fetching playlist for userId {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response(
            {'error': f'Lỗi server: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def create_new_playlist(request, user_id):
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['feelusic_db']
        collection = db['myplaylist']
        
        logger.debug(f"Creating new playlist for userId: {user_id}")
        existing_doc = collection.find_one({'userId': user_id})
        if not existing_doc:
            collection.insert_one({'userId': user_id, 'playlists': []})
        
        playlists = existing_doc.get('playlists', []) if existing_doc else []
        if len(playlists) >= 4:
            logger.warning(f"Maximum 4 playlists reached for userId: {user_id}")
            return Response(
                {'error': 'Bạn chỉ có thể tạo tối đa 4 danh sách phát'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        count = len(playlists)
        title = request.data.get('title', f'Danh sách {count + 1}')
        
        result = collection.update_one(
            {'userId': user_id},
            {'$push': {'playlists': {'title': title, 'songs': []}}},
            upsert=True
        )
        
        if result.modified_count > 0 or result.upserted_id:
            logger.info(f"Created new playlist for userId: {user_id}, title: {title}")
            return Response({'message': 'Đã tạo danh sách mới'}, status=status.HTTP_200_OK)
        logger.error(f"Failed to create playlist for userId: {user_id}")
        return Response({'error': 'Không thể tạo danh sách mới'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"Error creating playlist for userId {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def add_to_playlist(request, user_id):
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['feelusic_db']
        collection = db['myplaylist']
        
        playlist_index = request.data.get('playlistIndex')
        song = {
            'title': request.data.get('title'),
            'artist': request.data.get('artist'),
            'file_path': request.data.get('file_path', ''),
            'cover': request.data.get('cover', '/public/default_cover.png')
        }
        
        if not song['title'] or not song['artist'] or playlist_index is None:
            logger.error(f"Missing required fields: {song}, playlist_index: {playlist_index}")
            return Response({'error': 'Thiếu thông tin bắt buộc'}, status=status.HTTP_400_BAD_REQUEST)
        
        existing_doc = collection.find_one({'userId': user_id})
        if not existing_doc:
            collection.insert_one({'userId': user_id, 'playlists': []})
        
        playlists = existing_doc.get('playlists', []) if existing_doc else []
        if playlist_index >= len(playlists):
            logger.error(f"Invalid playlist_index {playlist_index} for userId {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)
        
        result = collection.update_one(
            {'userId': user_id},
            {'$push': {f'playlists.{playlist_index}.songs': song}},
            upsert=True
        )
        
        if result.modified_count > 0 or result.upserted_id:
            logger.info(f"Added song to playlist {playlist_index} for userId: {user_id}")
            return Response({'message': 'Đã thêm bài hát vào danh sách'}, status=status.HTTP_200_OK)
        logger.error(f"Failed to add song to playlist for userId: {user_id}")
        return Response({'error': 'Không thể thêm bài hát'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.error(f"Error adding song to playlist for userId {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def delete_playlist(request, user_id):
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['feelusic_db']
        collection = db['myplaylist']
        
        playlist_index = request.data.get('playlistIndex')
        if playlist_index is None:
            logger.error("Missing playlistIndex")
            return Response({'error': 'Thiếu playlistIndex'}, status=status.HTTP_400_BAD_REQUEST)
        
        existing_doc = collection.find_one({'userId': user_id})
        if not existing_doc or not existing_doc.get('playlists', []) or playlist_index >= len(existing_doc['playlists']):
            logger.warning(f"No playlist found at index {playlist_index} for userId: {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)
        
        result = collection.update_one(
            {'userId': user_id},
            {'$unset': {f'playlists.{playlist_index}': 1}}
        )
        collection.update_one(
            {'userId': user_id},
            {'$pull': {'playlists': None}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Deleted playlist at index {playlist_index} for userId: {user_id}")
            return Response({'message': 'Đã xóa danh sách'}, status=status.HTTP_200_OK)
        logger.warning(f"No changes made for playlistIndex {playlist_index} for userId: {user_id}")
        return Response({'error': 'Không thể xóa danh sách'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error deleting playlist for userId {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
def edit_playlist(request, user_id):
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['feelusic_db']
        collection = db['myplaylist']
        
        playlist_index = request.data.get('playlistIndex')
        new_title = request.data.get('newTitle', '')
        if playlist_index is None or not new_title:
            logger.error(f"Missing playlistIndex or newTitle: {request.data}")
            return Response({'error': 'Thiếu playlistIndex hoặc newTitle'}, status=status.HTTP_400_BAD_REQUEST)
        
        existing_doc = collection.find_one({'userId': user_id})
        if not existing_doc or not existing_doc.get('playlists', []) or playlist_index >= len(existing_doc['playlists']):
            logger.warning(f"No playlist found at index {playlist_index} for userId: {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)
        
        result = collection.update_one(
            {'userId': user_id},
            {'$set': {f'playlists.{playlist_index}.title': new_title}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Renamed playlist at index {playlist_index} to {new_title} for userId: {user_id}")
            return Response({'message': 'Đã sửa tên danh sách'}, status=status.HTTP_200_OK)
        logger.warning(f"No changes made for playlistIndex {playlist_index} for userId: {user_id}")
        return Response({'error': 'Không thể sửa tên danh sách'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error renaming playlist for userId {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['DELETE'])
def remove_song_from_playlist(request, user_id):
    try:
        client = MongoClient('mongodb://localhost:27017/')
        db = client['feelusic_db']
        collection = db['myplaylist']
        
        playlist_index = request.data.get('playlistIndex')
        song_index = request.data.get('songIndex')
        
        if playlist_index is None or song_index is None:
            logger.error("Missing playlistIndex or songIndex")
            return Response({'error': 'Thiếu playlistIndex hoặc songIndex'}, status=status.HTTP_400_BAD_REQUEST)
        
        existing_doc = collection.find_one({'userId': user_id})
        if not existing_doc or not existing_doc.get('playlists', []) or playlist_index >= len(existing_doc['playlists']):
            logger.warning(f"No playlist found at index {playlist_index} for userId: {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)
        
        songs = existing_doc['playlists'][playlist_index].get('songs', [])
        if song_index >= len(songs):
            logger.warning(f"No song found at index {song_index} in playlist {playlist_index} for userId: {user_id}")
            return Response({'error': 'Bài hát không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)
        
        result = collection.update_one(
            {'userId': user_id},
            {'$unset': {f'playlists.{playlist_index}.songs.{song_index}': 1}}
        )
        collection.update_one(
            {'userId': user_id},
            {'$pull': {f'playlists.{playlist_index}.songs': None}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Removed song at playlistIndex {playlist_index}, songIndex {song_index} for userId: {user_id}")
            return Response({'message': 'Đã xóa bài hát thành công'}, status=status.HTTP_200_OK)
        logger.warning(f"No changes made for playlistIndex {playlist_index}, songIndex {song_index} for userId: {user_id}")
        return Response({'error': 'Không thể xóa bài hát'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error removing song from playlist for userId {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
