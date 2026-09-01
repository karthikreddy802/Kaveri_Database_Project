from django.contrib import admin
from .models import Property, RoomType, Room, Rate, Guest, Booking, Payment, Review, Account, LegacyReservations

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ('property_id', 'name', 'city', 'stars')
    search_fields = ('name', 'city')
    list_filter = ('stars', 'city')


@admin.register(RoomType)
class RoomTypeAdmin(admin.ModelAdmin):
    list_display = ('room_type_id', 'type_name', 'max_occupancy')
    search_fields = ('type_name',)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('room_id', 'room_number', 'property', 'room_type')
    list_filter = ('property', 'room_type')
    search_fields = ('room_number',)


@admin.register(Rate)
class RateAdmin(admin.ModelAdmin):
    list_display = ('rate_id', 'property', 'room_type', 'start_date', 'end_date', 'nightly_rate')
    list_filter = ('property', 'room_type', 'start_date', 'end_date')
    search_fields = ('property__name', 'room_type__type_name')


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ('guest_id', 'name', 'email', 'phone', 'city')
    search_fields = ('name', 'email', 'phone', 'city')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('booking_id', 'guest', 'room', 'check_in', 'check_out', 'guest_count', 'status')
    list_filter = ('status', 'check_in', 'check_out', 'room__property')
    search_fields = ('guest__name', 'guest__email', 'room__room_number')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('payment_id', 'booking', 'amount', 'method', 'payment_date')
    list_filter = ('method', 'payment_date')
    search_fields = ('booking__booking_id', 'booking__guest__name')


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('review_id', 'booking', 'rating', 'comment', 'review_date')
    list_filter = ('rating', 'review_date')
    search_fields = ('booking__booking_id', 'booking__guest__name')


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('account_id', 'email', 'role', 'property', 'guest', 'created_at')
    list_filter = ('role', 'property')
    search_fields = ('email',)
    readonly_fields = ('created_at',)


@admin.register(LegacyReservations)
class LegacyReservationsAdmin(admin.ModelAdmin):
    list_display = ('row_id', 'guest_name', 'hotel_name', 'checkin', 'checkout', 'total_paid', 'status')
    search_fields = ('guest_name', 'guest_email', 'hotel_name')
