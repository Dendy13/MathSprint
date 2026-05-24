from pydantic import BaseModel, Field

class SystemConfig(BaseModel):
    """Konfigurasi sistem global (Feature Toggles)."""
    maintenance_mode: bool = Field(
        default=False, 
        description="Aktifkan ini untuk menutup akses bagi pemain (hanya developer yang bisa masuk)."
    )
    solo_mode_enabled: bool = Field(
        default=True, 
        description="Buka atau tutup mode latihan Solo 60 detik."
    )
    teacher_registration_enabled: bool = Field(
        default=True, 
        description="Buka atau tutup form pendaftaran akun Guru dengan token."
    )
