from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from mongoengine import connect, Document, fields, get_db
from mongoengine.queryset.visitor import Q
import bcrypt
import logging
import tensorflow as tf
import numpy as np
import cv2
import pandas as pd
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity
from bson import ObjectId
import re
import os
from dotenv import load_dotenv
import traceback

# Cấu hình logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load biến môi trường (đã được thực hiện trong settings.py, nhưng để chắc chắn)
load_dotenv()

# Sử dụng kết nối MongoDB từ settings.py
db = get_db('default')  # 'default' là alias được định nghĩa trong settings.py
history_collection = db['emotion_history']
songs_collection = db['songs']
artists_collection = db['artists']
albums_collection = db['albums']
historysongs_collection = db['historysongs']
historylists_collection = db['historylists']
loginhistory_collection = db['loginhistory']
myplaylist_collection = db['myplaylist']

# Load mô hình Keras
try:
    model = tf.keras.models.load_model('model/emotion_model.keras')
    logger.debug("Mô hình được tải thành công!")
    logger.debug(f"Input shape of model: {model.input_shape}")
    logger.debug(f"Output shape of model: {model.output_shape}")
except Exception as e:
    logger.error(f"Lỗi tải mô hình: {e}")
    model = None
    raise

# Định nghĩa 7 lớp của mô hình
model_emotions = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
emotion_mapping = {
    'angry': 'sad',
    'disgust': 'sad',
    'fear': 'sad',
    'happy': 'happy',
    'sad': 'sad',
    'surprise': 'happy',
    'neutral': 'neutral'
}
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

class UserProfile(Document):
    username = fields.StringField(required=True, unique=True)
    email = fields.EmailField(unique=True)
    password = fields.StringField(required=True)
    phone = fields.StringField()
    meta = {'collection': 'recommend_userprofile'}

@api_view(['POST'])
def register(request):
    try:
        data = request.data
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        phone = data.get('phone')
        logger.debug(f"Register request data: {data}")

        if not username or not password:
            logger.warning("Missing username or password")
            return Response({'message': 'Vui lòng nhập username và password'}, status=status.HTTP_400_BAD_REQUEST)

        if UserProfile.objects(username=username).first():
            logger.info(f"Username already exists: {username}")
            return Response({'message': 'Tên đăng nhập đã tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        if email and UserProfile.objects(email=email).first():
            logger.info(f"Email already exists: {email}")
            return Response({'message': 'Email đã tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_user = UserProfile(
            username=username,
            email=email,
            password=hashed_pw,
            phone=phone
        )
        new_user.save()
        logger.info(f"User registered successfully: {username}, id: {new_user.id}")
        return Response({'message': 'Đăng ký thành công'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Register error: {str(e)}\n{traceback.format_exc()}")
        return Response({'message': f"Lỗi server: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def login_view(request):
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        logger.debug(f"Login request data: {request.data}")

        if not username or not password:
            logger.warning("Missing username or password")
            return Response({'message': 'Vui lòng nhập username và password'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(username=username).first()
        if not user:
            logger.info(f"User not found: {username}")
            return Response({'message': 'Người dùng không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            logger.info(f"Wrong password for user: {username}")
            return Response({'message': 'Mật khẩu sai'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = str(user.id)
        device = request.headers.get('User-Agent', 'Unknown Device')
        loginhistory_collection.update_one(
            {'userId': user_id},
            {
                '$set': {'username': username},
                '$push': {
                    'logins': {
                        'timestamp': datetime.now(),
                        'device': device
                    }
                }
            },
            upsert=True
        )
        logger.info(f"Login successful for user: {username}, user_id: {user_id}")
        return Response({
            'message': 'Đăng nhập thành công',
            'userId': user_id,
            'username': username
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Login error: {str(e)}\n{traceback.format_exc()}")
        return Response({'message': f"Lỗi server: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def predict_emotion(request):
    try:
        if model is None:
            logger.warning("Mô hình không được tải, sử dụng emotion mặc định")
            return Response({
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral')
            }, status=status.HTTP_200_OK)

        if 'image' not in request.FILES:
            logger.warning("Không có ảnh được gửi")
            return Response({'error': 'Không có ảnh được gửi'}, status=status.HTTP_400_BAD_REQUEST)

        image_file = request.FILES['image']
        image_data = np.frombuffer(image_file.read(), np.uint8)
        image = cv2.imdecode(image_data, cv2.IMREAD_GRAYSCALE)
        logger.debug(f"Ảnh đầu vào shape: {image.shape if image is not None else 'None'}")

        if image is None:
            logger.error("Không đọc được ảnh")
            return Response({'error': 'Không đọc được ảnh'}, status=status.HTTP_400_BAD_REQUEST)

        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(image, scaleFactor=1.1, minNeighbors=4)
        logger.debug(f"Số khuôn mặt phát hiện: {len(faces)}")

        if len(faces) == 0:
            logger.debug("Không phát hiện khuôn mặt, sử dụng emotion mặc định 'neutral'.")
            return Response({
                'emotion': 'neutral',
                'confidence': 0.0,
                'playlist': recommend_songs('neutral')
            }, status=status.HTTP_200_OK)

        image = cv2.resize(image, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
        if image.shape != (IMG_SIZE, IMG_SIZE):
            logger.error(f"Kích thước ảnh sau resize không đúng: {image.shape}")
            return Response({'error': 'Kích thước ảnh sau resize không đúng'}, status=status.HTTP_400_BAD_REQUEST)

        image = image / 255.0
        image = np.expand_dims(image, axis=[0, -1])
        logger.debug(f"Hình ảnh sau xử lý shape: {image.shape}")

        prediction = model.predict(image, verbose=0)
        logger.debug(f"Dự đoán thô: {prediction}")

        if prediction.size == 0 or len(prediction.shape) < 2:
            logger.error(f"Dự đoán không hợp lệ, shape: {prediction.shape}")
            return Response({'error': 'Dự đoán không hợp lệ'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        emotion_idx = np.argmax(prediction[0])
        if emotion_idx >= len(model_emotions) or emotion_idx < 0:
            logger.error(f"Chỉ số cảm xúc không hợp lệ: {emotion_idx}")
            return Response({'error': 'Chỉ số cảm xúc không hợp lệ'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        model_emotion = model_emotions[emotion_idx]
        final_emotion = emotion_mapping[model_emotion]
        confidence = float(prediction[0][emotion_idx])
        logger.debug(f"Mô hình emotion: {model_emotion}, Final emotion: {final_emotion}")

        playlist = recommend_songs(final_emotion) if not songs_data.empty else []
        try:
            history_collection.insert_one({
                'emotion': final_emotion,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat()
            })
            logger.debug("Dữ liệu đã lưu vào MongoDB.")
        except Exception as e:
            logger.error(f"Lỗi lưu vào MongoDB: {e}")
            return Response({'error': f'Lỗi lưu vào MongoDB: {e}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'emotion': final_emotion,
            'confidence': confidence,
            'playlist': playlist,
            'note': 'Playlist rỗng nếu không có bài hát trong songs collection' if not playlist else ''
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi trong predict_emotion: {str(e)}\n{traceback.format_exc()}")
        return Response({
            'error': str(e),
            'fallback_emotion': 'neutral',
            'playlist': recommend_songs('neutral')
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def test_mongo(request):
    try:
        test_collection = db['test_collection']
        test_collection.insert_one({'test': 'Hello MongoDB', 'timestamp': datetime.now().isoformat()})
        data = list(test_collection.find())
        for item in data:
            item['_id'] = str(item['_id'])
        logger.info("Test MongoDB connection successful")
        return Response({'message': 'Kết nối MongoDB thành công', 'data': data}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi trong test_mongo: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_albums(request):
    try:
        albums = list(albums_collection.find().limit(100))
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
        logger.error(f"Lỗi khi lấy album: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_list(request):
    try:
        raw_documents = list(db['list'].find().limit(100))
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
        logger.error(f"Lỗi khi lấy danh sách phát: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def add_historysong(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.warning(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if not all(key in data for key in ['title', 'artist', 'file_path']):
            logger.warning(f"Missing required fields: {data}")
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        normalized_title = data['title'].strip().lower()
        file_path = data['file_path']
        if file_path and not file_path.startswith('/'):
            file_path = f"/{file_path}"

        history = historysongs_collection.find_one({'userId': user_id})
        songs = history.get('songs', []) if history else []

        songs = [s for s in songs if not (
            s['title'].strip().lower() == normalized_title and
            s['file_path'] == file_path
        )]

        new_song = {
            'title': data['title'],
            'artist': data.get('artist', 'Unknown Artist'),
            'file_path': file_path,
            'cover': data.get('cover', '/public/default_cover.png'),
            'listenedAt': datetime.now()
        }
        songs.insert(0, new_song)
        songs = songs[:10]

        historysongs_collection.replace_one(
            {'userId': user_id},
            {'userId': user_id, 'username': username, 'songs': songs},
            upsert=True
        )
        logger.info(f"Thêm bài hát vào lịch sử thành công cho userId: {user_id}")
        return Response({'message': 'Thêm bài hát vào lịch sử thành công'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi thêm bài hát vào lịch sử: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def add_historylist(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.warning(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if not all(key in data for key in ['title', 'artist', 'songs']):
            logger.warning(f"Missing required fields: {data}")
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        normalized_title = data['title'].strip().lower()
        songs = data['songs']
        song_srcs = [s['src'] for s in songs if 'src' in s]

        history = historylists_collection.find_one({'userId': user_id})
        if history and any(
            l['title'].strip().lower() == normalized_title and
            [s['src'] for s in l['songs']] == song_srcs
            for l in history.get('lists', [])
        ):
            logger.info(f"Danh sách đã tồn tại cho userId: {user_id}")
            return Response({'message': 'Danh sách đã tồn tại'}, status=status.HTTP_200_OK)

        if not history:
            history = {'userId': user_id, 'username': username, 'lists': []}

        history['lists'].insert(0, {
            'title': data['title'],
            'artist': data['artist'],
            'cover': data.get('cover', '/public/default_cover.png'),
            'songs': songs,
            'listenedAt': datetime.now()
        })
        history['lists'] = history['lists'][:10]

        historylists_collection.replace_one({'userId': user_id}, history, upsert=True)
        logger.info(f"Thêm danh sách vào lịch sử thành công cho userId: {user_id}")
        return Response({'message': 'Thêm danh sách vào lịch sử thành công'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi thêm danh sách vào lịch sử: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_historysongs(request, user_id):
    try:
        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
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
                'title': song['title'],
                'artist': song.get('artist', 'Unknown Artist'),
                'file_path': file_path,
                'cover': cover,
                'listenedAt': song.get('listenedAt', '').isoformat() if song.get('listenedAt') else ''
            })

        songs = sorted(processed_songs, key=lambda x: x.get('listenedAt', datetime.min), reverse=True)
        logger.info(f"Lấy lịch sử bài hát thành công cho userId: {user_id}")
        return Response({'message': 'Lấy lịch sử bài hát thành công', 'data': {'songs': songs}}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy lịch sử bài hát: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_historylists(request, user_id):
    try:
        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
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
                'title': item['title'],
                'artist': item.get('artist', 'Unknown Artist'),
                'cover': cover,
                'songs': songs,
                'listenedAt': item.get('listenedAt', '').isoformat() if item.get('listenedAt') else ''
            })

        lists = sorted(processed_lists, key=lambda x: x.get('listenedAt', datetime.min), reverse=True)
        logger.info(f"Lấy lịch sử danh sách thành công cho userId: {user_id}")
        return Response({'message': 'Lấy lịch sử danh sách thành công', 'data': {'lists': lists}}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy lịch sử danh sách: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_login_history(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.warning(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        history = loginhistory_collection.find_one({'userId': user_id})
        logins = history.get('logins', []) if history else []
        processed_logins = [
            {
                'timestamp': login.get('timestamp', '').isoformat() if login.get('timestamp') else '',
                'device': login.get('device', 'Unknown Device')
            } for login in logins
        ]
        processed_logins = sorted(processed_logins, key=lambda x: x.get('timestamp', datetime.min), reverse=True)
        logger.info(f"Lấy lịch sử đăng nhập cho user {user_id}: {len(processed_logins)} bản ghi")
        return Response({
            'message': 'Lấy lịch sử đăng nhập thành công',
            'data': processed_logins
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy lịch sử đăng nhập cho user {user_id}: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_artists(request):
    try:
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
        logger.error(f"Lỗi khi lấy danh sách nghệ sĩ: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_artist_albums(request, artist_id):
    try:
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
        logger.error(f"Lỗi khi lấy album của nghệ sĩ: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_update_artist(request):
    try:
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
        logger.error(f"Lỗi khi tạo/cập nhật nghệ sĩ: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_album(request):
    try:
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
        logger.error(f"Lỗi khi tạo album: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_user(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.warning(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'username': user.username,
            'email': user.email or '',
            'phone': user.phone or ''
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi lấy thông tin người dùng: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi khi lấy thông tin người dùng: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['PUT'])
def update_user(request, user_id):
    try:
        if not user_id or user_id in ['None', 'null', 'undefined']:
            logger.warning(f"Invalid user_id: {user_id}")
            return Response({'error': 'Invalid user_id'}, status=status.HTTP_400_BAD_REQUEST)

        user = UserProfile.objects(id=user_id).first()
        if not user:
            logger.warning(f"Người dùng không tồn tại: {user_id}")
            return Response({'error': 'Người dùng không tồn tại'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        update_data = {}
        email = data.get('email')
        password = data.get('password')

        if email:
            if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
                logger.warning(f"Email không hợp lệ: {email}")
                return Response({'error': 'Email không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

            if UserProfile.objects(Q(email=email) & Q(id__ne=user_id)).first():
                logger.warning(f"Email đã được sử dụng: {email}")
                return Response({'error': 'Email đã được sử dụng'}, status=status.HTTP_400_BAD_REQUEST)
            update_data['email'] = email

        if password:
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            update_data['password'] = hashed_password

        if not update_data:
            logger.warning("Không có thông tin để cập nhật")
            return Response({'error': 'Không có thông tin để cập nhật'}, status=status.HTTP_400_BAD_REQUEST)

        result = UserProfile.objects(id=user_id).update(**update_data)
        if result == 0:
            logger.warning(f"Không thể cập nhật thông tin cho userId: {user_id}")
            return Response({'error': 'Không thể cập nhật thông tin'}, status=status.HTTP_400_BAD_REQUEST)

        updated_user = UserProfile.objects(id=user_id).first()
        logger.info(f"Cập nhật thành công cho userId: {user_id}")
        return Response({
            'message': 'Cập nhật thành công',
            'username': updated_user.username,
            'email': updated_user.email or '',
            'phone': updated_user.phone or ''
        }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Lỗi khi cập nhật thông tin: {str(e)}\n{traceback.format_exc()}")
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
        logger.error(f"Lỗi khi lấy bài hát theo nghệ sĩ '{artist}': {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def search(request):
    try:
        query = request.GET.get('query', '').strip()
        if not query:
            logger.warning("Thiếu truy vấn tìm kiếm")
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
        logger.error(f"Lỗi khi tìm kiếm: {str(e)}\n{traceback.format_exc()}")
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
            logger.warning("Không có thể loại hợp lệ")
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
        logger.error(f"Lỗi khi lấy bài hát theo thể loại: {str(e)}\n{traceback.format_exc()}")
        return Response({'error': f'Lỗi server: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_my_playlist(request, user_id):
    try:
        logger.debug(f"Fetching playlist for userId: {user_id}")
        playlist = myplaylist_collection.find_one({'userId': user_id})
        if not playlist:
            logger.info(f"No playlist found for userId: {user_id}")
            return Response(
                {'message': 'Không tìm thấy danh sách cá nhân', 'data': {'playlists': []}},
                status=status.HTTP_200_OK
            )

        playlists = playlist.get('playlists', [])
        if not isinstance(playlists, list):
            logger.error(f"Invalid playlists format for userId {user_id}: {playlists}")
            myplaylist_collection.update_one(
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
        logger.debug(f"Creating new playlist for userId: {user_id}")
        existing_doc = myplaylist_collection.find_one({'userId': user_id})
        if not existing_doc:
            myplaylist_collection.insert_one({'userId': user_id, 'playlists': []})

        playlists = existing_doc.get('playlists', []) if existing_doc else []
        if len(playlists) >= 4:
            logger.warning(f"Maximum 4 playlists reached for userId: {user_id}")
            return Response(
                {'error': 'Bạn chỉ có thể tạo tối đa 4 danh sách phát'},
                status=status.HTTP_400_BAD_REQUEST
            )

        count = len(playlists)
        title = request.data.get('title', f'Danh sách {count + 1}')

        result = myplaylist_collection.update_one(
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

        existing_doc = myplaylist_collection.find_one({'userId': user_id})
        if not existing_doc:
            myplaylist_collection.insert_one({'userId': user_id, 'playlists': []})

        playlists = existing_doc.get('playlists', []) if existing_doc else []
        if playlist_index >= len(playlists):
            logger.error(f"Invalid playlist_index {playlist_index} for userId {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        result = myplaylist_collection.update_one(
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
        playlist_index = request.data.get('playlistIndex')
        if playlist_index is None:
            logger.error("Missing playlistIndex")
            return Response({'error': 'Thiếu playlistIndex'}, status=status.HTTP_400_BAD_REQUEST)

        existing_doc = myplaylist_collection.find_one({'userId': user_id})
        if not existing_doc or not existing_doc.get('playlists', []) or playlist_index >= len(existing_doc['playlists']):
            logger.warning(f"No playlist found at index {playlist_index} for userId: {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        result = myplaylist_collection.update_one(
            {'userId': user_id},
            {'$unset': {f'playlists.{playlist_index}': 1}}
        )
        myplaylist_collection.update_one(
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
        playlist_index = request.data.get('playlistIndex')
        new_title = request.data.get('newTitle', '')
        if playlist_index is None or not new_title:
            logger.error(f"Missing playlistIndex or newTitle: {request.data}")
            return Response({'error': 'Thiếu playlistIndex hoặc newTitle'}, status=status.HTTP_400_BAD_REQUEST)

        existing_doc = myplaylist_collection.find_one({'userId': user_id})
        if not existing_doc or not existing_doc.get('playlists', []) or playlist_index >= len(existing_doc['playlists']):
            logger.warning(f"No playlist found at index {playlist_index} for userId: {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        # Kiểm tra xem tiêu đề mới có hợp lệ không (không trùng với các playlist khác)
        playlists = existing_doc.get('playlists', [])
        normalized_new_title = new_title.strip().lower()
        for i, playlist in enumerate(playlists):
            if i != playlist_index and playlist.get('title', '').strip().lower() == normalized_new_title:
                logger.warning(f"Playlist title '{new_title}' already exists for userId: {user_id}")
                return Response({'error': 'Tiêu đề danh sách đã tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        result = myplaylist_collection.update_one(
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
        playlist_index = request.data.get('playlistIndex')
        song_index = request.data.get('songIndex')

        if playlist_index is None or song_index is None:
            logger.error("Missing playlistIndex or songIndex")
            return Response({'error': 'Thiếu playlistIndex hoặc songIndex'}, status=status.HTTP_400_BAD_REQUEST)

        existing_doc = myplaylist_collection.find_one({'userId': user_id})
        if not existing_doc or not existing_doc.get('playlists', []) or playlist_index >= len(existing_doc['playlists']):
            logger.warning(f"No playlist found at index {playlist_index} for userId: {user_id}")
            return Response({'error': 'Danh sách không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        songs = existing_doc['playlists'][playlist_index].get('songs', [])
        if song_index >= len(songs):
            logger.warning(f"No song found at index {song_index} in playlist {playlist_index} for userId: {user_id}")
            return Response({'error': 'Bài hát không tồn tại'}, status=status.HTTP_400_BAD_REQUEST)

        result = myplaylist_collection.update_one(
            {'userId': user_id},
            {'$unset': {f'playlists.{playlist_index}.songs.{song_index}': 1}}
        )
        myplaylist_collection.update_one(
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

def json_serial(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError("Type not serializable")