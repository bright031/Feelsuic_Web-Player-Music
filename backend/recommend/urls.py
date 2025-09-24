from django.urls import path
from . import views
urlpatterns = [
    path('api/register', views.register, name='register'),
    path('api/login', views.login_view, name='login'),
    path('api/predict-emotion', views.predict_emotion, name='predict_emotion'),
    path('api/test-mongo', views.test_mongo, name='test_mongo'),
    path('api/albums', views.get_albums, name='get_albums'),
    path('api/list', views.get_list, name='get_list'),
    path('api/historysong/<str:user_id>', views.get_historysongs, name='get_historysongs'),  # GET
    path('api/historysong/add/<str:user_id>', views.add_historysong, name='add_historysong'),  # POST
    path('api/historylist/<str:user_id>', views.get_historylists, name='get_historylists'),  # GET
    path('api/historylist/add/<str:user_id>', views.add_historylist, name='add_historylist'),  # POST
path('api/songs-by-genre', views.songs_by_genre, name='songs-by-genre'),
path('api/search', views.search, name='search'),
    path('api/songs-by-artist', views.songs_by_artist, name='songs_by_artist'),
    path('api/artists/', views.get_artists, name='get_artists'),  # Lấy danh sách nghệ sĩ
    path('api/artist-albums/<str:artist_id>/', views.get_artist_albums, name='get_artist_albums'),  # Lấy album của nghệ sĩ
    path('api/artists/create', views.create_update_artist, name='create_update_artist'),  # Tạo/cập nhật nghệ sĩ
    path('api/albums/create', views.create_album, name='create_album'),  # Tạo album
    path('api/user/<str:user_id>', views.get_user, name='get_user'),
    path('api/user/<str:user_id>', views.update_user, name='update_user'),
    
    path('api/update_user/<str:user_id>', views.update_user, name='update_user'),
    path('api/music-history/<str:user_id>', views.get_historysongs, name='get_historysongs'),
    path('api/login-history/<str:user_id>', views.get_login_history, name='get_login_history'),
    
    path('', views.index, name='index'),  
    path('recommend/', views.recommend, name='recommend'),
    path('api/myplaylist/<str:user_id>', views.get_my_playlist, name='get_my_playlist'),
    path('api/create-new-playlist/<str:user_id>', views.create_new_playlist, name='create_new_playlist'),
    path('api/add-to-playlist/<str:user_id>', views.add_to_playlist, name='add_to_playlist'),
    path('api/delete-playlist/<str:user_id>', views.delete_playlist, name='delete_playlist'),
    path('api/edit-playlist/<str:user_id>', views.edit_playlist, name='edit_playlist'),
    path('api/remove-song-from-playlist/<str:user_id>', views.remove_song_from_playlist, name='remove_song_from_playlist'),
]
