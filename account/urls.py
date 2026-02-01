from django.urls import path
from . import views, AuthenticationMethods
from django.contrib.auth import logout
from django.http import HttpResponseRedirect



def custom_logout(request):
    """Обрабатывает GET-запросы для выхода"""
    logout(request)  # Завершение сессии пользователя
    return HttpResponseRedirect('/')  # Редирект на главную страницу


urlpatterns = [
    path('signup/', AuthenticationMethods.signup, name='signup'),
    path('login/', AuthenticationMethods.LoginView.as_view(), name='login'),
    path('logout/', custom_logout, name='logout'),
    # path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    # path('profile/<int:pk>/', views.UserProfileView.as_view(), name='user-detail'),
    # path('profile/info/', views.add_info, name='add-info'),
]