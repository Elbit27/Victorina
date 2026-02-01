from django.contrib.auth import views
from account import serializers
from django.contrib.auth import login
from django.shortcuts import render, redirect
from django.contrib.auth.forms import AuthenticationForm

class CustomAuthenticationForm(AuthenticationForm):
    error_messages = {
        "invalid_login": "Неверный логин или пароль. Попробуйте ещё раз.",
        "inactive": "Этот аккаунт отключён.",
    }

class LoginView(views.LoginView):
    template_name = 'core/login.html'
    authentication_form = CustomAuthenticationForm



def signup(request):
    if request.method == 'POST':
        serializer = serializers.UserRegisterSerializer(data=request.POST)
        if serializer.is_valid():
            user = serializer.save()
            login(request, user)
            return redirect('/')
        else:
            return render(request, 'core/signup.html', {
                'errors': serializer.errors,
                'form_data': request.POST  # Передаем данные, чтобы они не исчезали
            })

    return render(request, 'core/signup.html')