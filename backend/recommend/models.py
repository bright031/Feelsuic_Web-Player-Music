from mongoengine import Document, StringField, EmailField,  ListField, FloatField

class UserProfile(Document):
    meta = {'collection': 'userprofile'}  

    username = StringField(required=True, unique=True, max_length=255)
    password = StringField(required=True, max_length=255)
    email = EmailField(unique=True, null=True)
    phone = StringField(max_length=15, null=True)
    songs = ListField(StringField())  
    def __str__(self):
        return self.username
    
class EmotionHistory(Document):
    username = StringField(required=True)
    emotion = StringField(required=True)
    confidence = FloatField(required=True)
    timestamp = StringField(required=True)  

    meta = {'collection': 'emotion_history'}