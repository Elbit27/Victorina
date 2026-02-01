from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from django.contrib.auth.models import User

class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username')


class UserRegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(min_length=8, write_only=True, required=True)
    password2 = serializers.CharField(min_length=8, write_only=True, required=True)
    username = serializers.CharField(write_only=True, required=False)  # Мы делаем его необязательным


    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2')

    def validate(self, attrs):
        print(attrs, '!!!!')
        password2 = attrs.pop('password2')
        if password2 != attrs['password']:
            raise serializers.ValidationError("Пароли не совпадают")
        validate_password(attrs['password'])

        # Устанавливаем username
        if not attrs.get('username'):
            attrs['username'] = attrs['email'].split('@')[0]  # Используем email до '@' как username


        if User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({"username": "Аккаунт с такими данными уже существует"})

        return attrs

    def create(self, validated_data):
        user = User.objects.create(**validated_data)
        user.set_password(validated_data['password'])
        user.save()
        return user

class UserDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        exclude = ('password',)


#
# class DetailUserSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = DetailUser
#         fields = ['phone_number', 'age', 'city', 'about']