class Session < ApplicationRecord
  belongs_to :user

  # user_id is an integer FK referencing users.id (integer PK).
  # This FK will change to uuid after the UUID migration (eval 14 target).
  validates :token, presence: true, uniqueness: true
  validates :expires_at, presence: true

  scope :active, -> { where("expires_at > ?", Time.current) }

  def expired?
    expires_at <= Time.current
  end
end
