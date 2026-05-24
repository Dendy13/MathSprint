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
    matchmaking_enabled: bool = Field(
        default=False,
        description="Aktifkan fitur Duel (Matchmaking)."
    )
    matchmaking_allow_custom_config: bool = Field(
        default=False,
        description="Izinkan pemain memilih operasi dan kesulitan saat Duel. Jika mati, gunakan fixed_op dan fixed_diff."
    )
    matchmaking_fixed_op: str = Field(
        default="add",
        description="Operasi default untuk Duel jika custom config dimatikan."
    )
    matchmaking_fixed_diff: str = Field(
        default="medium",
        description="Kesulitan default untuk Duel jika custom config dimatikan."
    )
