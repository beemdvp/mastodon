class CreateSocialsLink < ActiveRecord::Migration[7.1]
  def change
    create_table :socials_links do |t|
      t.string :mastodon_id
      t.string :x_id
      t.string :string

      t.timestamps
    end
  end
end
