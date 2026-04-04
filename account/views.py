from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from .forms import OnboardingForm


@login_required
def complete_profile(request):
    if request.method == 'POST':
        form = OnboardingForm(request.POST, instance=request.user)
        if form.is_valid():
            form.save()
            return redirect('home')
    else:
        form = OnboardingForm(instance=request.user)

    return render(request, 'account/complete_profile.html', {'form': form})