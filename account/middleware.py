from django.shortcuts import redirect
from django.urls import reverse, NoReverseMatch

class ProfileCompleteMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            try:
                onboarding_url = reverse('complete_profile')
                logout_url = reverse('account_logout')
            except NoReverseMatch:
                return self.get_response(request)

            # Проверки, чтобы не редиректить бесконечно
            is_onboarding = request.path == onboarding_url
            is_logout = request.path == logout_url
            is_admin = request.path.startswith('/admin/')
            is_static = request.path.startswith('/static/') or request.path == '/favicon.ico'

            if not request.user.role and not any([is_onboarding, is_logout, is_admin, is_static]):
                return redirect(onboarding_url)

        return self.get_response(request)