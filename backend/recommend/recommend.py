from pymongo import MongoClient
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Kết nối MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['feelusic']
music_collection = db['emotion_history']  

# Lấy dữ liệu từ MongoDB và chuyển thành DataFrame
music_data = pd.DataFrame(list(music_collection.find()), columns=[
    'title', 'artist', 'genre', 'emotion', 'bpm', 'file_path', 'cover'
]).fillna({'file_path': '', 'cover': ''})  # Điền giá trị trống

def recommend_songs(emotion, top_k=2):
    # Lọc bài hát theo cảm xúc
    filtered_songs = music_data[music_data['emotion'] == emotion]
    if filtered_songs.empty:
        filtered_songs = music_data[music_data['emotion'] == 'Neutral']  # Mặc định Neutral nếu không có

    # Sử dụng bpm làm đặc trưng (có thể mở rộng với thêm dữ liệu khác)
    features = filtered_songs[['bpm']].values
    if len(features) > 1:
        similarity = cosine_similarity(features)
        indices = np.argsort(similarity.mean(axis=1))[-top_k:][::-1]
    else:
        indices = range(min(top_k, len(filtered_songs)))

    recommended_songs = filtered_songs.iloc[indices][['title', 'artist', 'genre', 'file_path', 'cover']].to_dict('records')
    return recommended_songs

# Cập nhật dữ liệu khi khởi động (tùy chọn)
def update_music_data():
    global music_data
    music_data = pd.DataFrame(list(music_collection.find()), columns=[
        'title', 'artist', 'genre', 'emotion', 'bpm', 'file_path', 'cover'
    ]).fillna({'file_path': '', 'cover': ''})

# Gọi khi khởi động (nếu cần)
update_music_data()