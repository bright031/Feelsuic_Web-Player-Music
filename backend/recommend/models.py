from mongoengine import Document, StringField, EmailField,  IntField

class UserProfile(Document):
    meta = {'collection': 'recommend_userprofile'}  

    username = StringField(required=True, unique=True, max_length=255)
    password = StringField(required=True, max_length=255)
    email = EmailField(unique=True, null=True)
    phone = StringField(max_length=15, null=True)

    def __str__(self):
        return self.username
