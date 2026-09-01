from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal

class Property(models.Model):
    property_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    city = models.CharField(max_length=50)
    stars = models.SmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        blank=True,
        null=True
    )

    class Meta:
        db_table = 'property'
        verbose_name_plural = "Properties"

    def __str__(self):
        return f"{self.name} ({self.city})"


class RoomType(models.Model):
    room_type_id = models.AutoField(primary_key=True)
    type_name = models.CharField(unique=True, max_length=20)
    max_occupancy = models.SmallIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = 'room_type'

    def __str__(self):
        return self.type_name


class Room(models.Model):
    room_id = models.AutoField(primary_key=True)
    property = models.ForeignKey(Property, on_delete=models.RESTRICT, related_name='rooms')
    room_number = models.CharField(max_length=10)
    room_type = models.ForeignKey(RoomType, on_delete=models.RESTRICT, related_name='rooms')

    class Meta:
        db_table = 'room'
        unique_together = ('property', 'room_number')

    def __str__(self):
        return f"Room {self.room_number} - {self.property.name}"


class Rate(models.Model):
    rate_id = models.AutoField(primary_key=True)
    property = models.ForeignKey(Property, on_delete=models.RESTRICT, related_name='rates')
    room_type = models.ForeignKey(RoomType, on_delete=models.RESTRICT, related_name='rates')
    start_date = models.DateField()
    end_date = models.DateField()
    nightly_rate = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])

    class Meta:
        db_table = 'rate'

    def clean(self):
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError("End date must be strictly after start date.")

    def __str__(self):
        return f"{self.property.name} - {self.room_type.type_name} ({self.start_date} to {self.end_date}): {self.nightly_rate}"


class Guest(models.Model):
    guest_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True, max_length=255)
    phone = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = 'guest'

    def __str__(self):
        return self.name


class Booking(models.Model):
    BOOKING_STATUS_CHOICES = [
        ('confirmed', 'Confirmed'),
        ('checked_in', 'Checked In'),
        ('checked_out', 'Checked Out'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]

    booking_id = models.AutoField(primary_key=True)
    guest = models.ForeignKey(Guest, on_delete=models.RESTRICT, related_name='bookings')
    room = models.ForeignKey(Room, on_delete=models.RESTRICT, related_name='bookings')
    check_in = models.DateField()
    check_out = models.DateField()
    guest_count = models.IntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=20, choices=BOOKING_STATUS_CHOICES)

    class Meta:
        db_table = 'booking'

    def clean(self):
        if self.check_in and self.check_out and self.check_in >= self.check_out:
            raise ValidationError("Check-out date must be strictly after check-in date.")
        
        # Verify guest count does not exceed max occupancy (survives trigger anyway, but good for ORM level check)
        if self.room and self.guest_count:
            max_occ = self.room.room_type.max_occupancy
            if self.guest_count > max_occ:
                raise ValidationError(f"Guest count ({self.guest_count}) exceeds room maximum occupancy ({max_occ}).")

    def __str__(self):
        return f"Booking {self.booking_id} - Guest {self.guest.name} ({self.status})"


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('card', 'Card'),
        ('upi', 'UPI'),
        ('bank_transfer', 'Bank Transfer'),
        ('cash', 'Cash'),
    ]

    payment_id = models.AutoField(primary_key=True)
    booking = models.ForeignKey(Booking, on_delete=models.RESTRICT, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_date = models.DateField()

    class Meta:
        db_table = 'payment'

    def __str__(self):
        return f"Payment {self.payment_id} - Booking {self.booking.booking_id} ({self.amount})"


class Review(models.Model):
    review_id = models.AutoField(primary_key=True)
    booking = models.OneToOneField(Booking, on_delete=models.RESTRICT, related_name='review')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], blank=True, null=True)
    comment = models.TextField(blank=True, null=True)
    review_date = models.DateField(blank=True, null=True)

    class Meta:
        db_table = 'review'

    def clean(self):
        if self.booking and self.booking.status != 'checked_out':
            raise ValidationError("Reviews can only be written for completed stays (status: checked_out).")

    def __str__(self):
        return f"Review {self.review_id} - Booking {self.booking.booking_id} ({self.rating}/5)"


class Account(models.Model):
    ROLE_CHOICES = [
        ('guest', 'Guest'),
        ('staff', 'Staff'),
        ('manager', 'Manager'),
        ('owner', 'Owner'),
    ]

    account_id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True, max_length=255)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    property = models.ForeignKey(Property, on_delete=models.SET_NULL, null=True, blank=True, related_name='accounts')
    guest = models.ForeignKey(Guest, on_delete=models.SET_NULL, null=True, blank=True, related_name='accounts')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'account'

    def clean(self):
        # Enforce: Manager and Staff belong to exactly one property, Owner and Guest to none
        if self.role in ['staff', 'manager'] and not self.property:
            raise ValidationError(f"Role '{self.role}' must be associated with a property.")
        if self.role in ['guest', 'owner'] and self.property:
            raise ValidationError(f"Role '{self.role}' cannot be associated with a property.")
            
        # Enforce: Guest role must link to a guest record; Owner must not.
        if self.role == 'guest' and not self.guest:
            raise ValidationError("Guest accounts must link to a physical guest record.")
        if self.role == 'owner' and self.guest:
            raise ValidationError("Owner accounts cannot link to a guest record.")

    def __str__(self):
        return f"Account {self.email} ({self.role})"


class LegacyReservations(models.Model):
    row_id = models.TextField(blank=True, null=True)
    guest_name = models.TextField(blank=True, null=True)
    guest_email = models.TextField(blank=True, null=True)
    guest_phone = models.TextField(blank=True, null=True)
    guest_city = models.TextField(blank=True, null=True)
    hotel_name = models.TextField(blank=True, null=True)
    hotel_city = models.TextField(blank=True, null=True)
    hotel_star = models.TextField(blank=True, null=True)
    room_numbers = models.TextField(blank=True, null=True)
    room_type = models.TextField(blank=True, null=True)
    guests_count = models.TextField(blank=True, null=True)
    checkin = models.TextField(blank=True, null=True)
    checkout = models.TextField(blank=True, null=True)
    nightly_rate = models.TextField(blank=True, null=True)
    total_paid = models.TextField(blank=True, null=True)
    payment_method = models.TextField(blank=True, null=True)
    status = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'legacy_reservations'
